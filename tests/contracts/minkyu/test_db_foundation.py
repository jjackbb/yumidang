"""가상 DB 연결 계약 검사. SQL/RLS/실제 경쟁 상태 테스트가 아니다."""
import copy
from datetime import datetime
import json
from pathlib import Path
import unittest
import uuid

FIXTURE = Path(__file__).resolve().parents[2] / 'fixtures/minkyu/db-foundation.json'
INTERNAL = {'loadPublicReviewSnapshot', 'publishReviewSummary', 'enqueueJob',
            'claimJob', 'completeJob', 'retryJob'}
FORBIDDEN = {'exactLocation', 'exact_location', 'registeredAddress', 'meetingPoint',
             'realName', 'real_name', 'phone', 'birthDate', 'di', 'leaseToken'}


def keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from keys(child)


def time(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def eligible(state):
    return {review['reviewId']: review['text'] for review in state.get('reviews', [])
            if review['public'] and review['releaseEligible'] and review['text'].strip()}


def validate(case):
    """문서상 필수 불변조건만 검사하며 실행기/DB를 흉내내지 않는다."""
    op, request, state, response = (case[key] for key in
                                   ('operation', 'request', 'state', 'response'))
    assert str(uuid.UUID(response['requestId'])) == response['requestId']
    assert uuid.UUID(response['requestId']).version == 4
    assert set(response) in ({'data', 'requestId'}, {'error', 'requestId'})
    error = response.get('error')
    if error:
        assert set(error) == {'code', 'message', 'retryable'}
        assert error['code'] in {'AUTH_REQUIRED', 'ACCESS_DENIED', 'STATE_CONFLICT'}
        assert error['retryable'] is False
        assert error['message'] == {
            'AUTH_REQUIRED': '로그인이 필요합니다.',
            'ACCESS_DENIED': '요청을 수행할 권한이 없습니다.',
            'STATE_CONFLICT': '현재 상태에서 요청을 처리할 수 없습니다.',
        }[error['code']]
    data = response.get('data')
    denied = (op in INTERNAL and case['caller'] != 'internal') or (
        op == 'getVisibleReviewSummary' and case['caller'] == 'anonymous')
    if denied:
        assert error
        assert error['code'] == ('AUTH_REQUIRED' if case['caller'] == 'anonymous'
                                 else 'ACCESS_DENIED')
        return
    if op == 'searchPublicPosts':
        assert not error
        assert not FORBIDDEN.intersection(keys(data))
        assert set(data) == {'items', 'nextCursor'}
        for item in data['items']:
            assert set(item) == {'postId', 'title', 'publicArea', 'authorDisplayName'}
            if case['caller'] == 'anonymous':
                assert item['authorDisplayName'].startswith('동행친구-')
            else:
                assert '*' in item['authorDisplayName']
    elif op == 'loadPublicReviewSnapshot':
        assert not error
        assert data['sourceRevision'] == state['sourceRevision']
        expected = eligible(state)
        assert data['eligibleCount'] == len(expected) == len(data['reviews'])
        assert {r['reviewId']: r['text'] for r in data['reviews']} == expected
        assert all(set(r) == {'reviewId', 'text'} for r in data['reviews'])
    elif op == 'publishReviewSummary':
        expected = eligible(state)
        evidence = request['evidenceReviewIds']
        valid = (request['sourceRevision'] == state['sourceRevision']
                 and len(expected) >= 3 and len(evidence) == len(set(evidence))
                 and set(evidence) == set(expected))
        if not valid:
            assert error and error['code'] == 'STATE_CONFLICT'
        else:
            assert not error
            assert data['sourceRevision'] == state['sourceRevision']
            assert data['sourceCount'] == len(expected)
    elif op == 'getVisibleReviewSummary':
        assert not error
        visible = state['storedRevision'] == state['sourceRevision'] and len(eligible(state)) >= 3
        if not visible:
            assert data['summary'] is None
        else:
            assert data['summary']['sourceCount'] == len(eligible(state))
        assert not FORBIDDEN.intersection(keys(data))
    elif op == 'enqueueJob':
        existing = state.get('existing')
        if existing:
            assert (request['kind'], request['dedupeKey']) == (existing['kind'], existing['dedupeKey'])
            if existing['payload'] != request['payload']:
                assert error and error['code'] == 'STATE_CONFLICT'
            else:
                assert not error
                assert data['jobId'] == existing['jobId']
                assert data['deduplicated'] is True
                assert data['status'] == existing['status']
        else:
            assert not error and data['deduplicated'] is False
        assert set(request['payload']) == {'profileId', 'sourceRevision'}
    elif op == 'claimJob':
        assert not error
        job = data['job']
        running = state['status'] == 'running'
        if running and time(state['now']) < time(state['leaseExpiresAt']):
            assert job is None
        else:
            assert job and time(job['leaseExpiresAt']) > time(state['now'])
            if not running:
                assert state['status'] in {'queued', 'retry_wait'}
                assert time(state['availableAt']) <= time(state['now'])
            if running:
                assert job['leaseToken'] != state['leaseToken']
                assert job['attempt'] == state['attempt'] + 1
    elif op in {'completeJob', 'retryJob'}:
        valid = (state['status'] == 'running'
                 and request['leaseToken'] == state['leaseToken']
                 and time(state['now']) < time(state['leaseExpiresAt']))
        if valid:
            assert not error
            assert data['jobId'] == request['jobId']
            assert data['status'] == ('succeeded' if op == 'completeJob' else 'retry_wait')
        else:
            assert error and error['code'] == 'STATE_CONFLICT'
    else:
        raise AssertionError(f'알 수 없는 계약: {op}')


class DBFoundationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        document = json.loads(FIXTURE.read_text())
        assert document['status'] == 'proposed-unimplemented'
        cls.cases = {case['id']: case for case in document['cases']}
        assert len(cls.cases) == len(document['cases'])

    def test_examples_obey_invariants(self):
        for name, case in self.cases.items():
            with self.subTest(name=name):
                validate(case)

    def test_required_failure_and_race_examples_exist(self):
        self.assertTrue({'search_address_anon', 'search_address_member', 'search_empty',
                         'snapshot_denied', 'snapshot_below_threshold',
                         'summary_revision_conflict', 'summary_insufficient',
                         'summary_evidence_conflict', 'summary_hidden',
                         'job_duplicate', 'job_payload_conflict', 'job_competing_claim',
                         'job_reclaim', 'job_stale_token', 'job_expired', 'job_retry',
                         'job_denied'}.issubset(self.cases))

    def test_private_field_in_public_card_is_rejected(self):
        for forbidden in FORBIDDEN:
            case = copy.deepcopy(self.cases['search_address_anon'])
            case['response']['data']['items'][0][forbidden] = '금지 가상값'
            with self.subTest(field=forbidden), self.assertRaises(AssertionError):
                validate(case)

    def test_snapshot_cannot_include_private_or_blank_review(self):
        for bad in self.cases['snapshot_public']['state']['reviews'][3:]:
            case = copy.deepcopy(self.cases['snapshot_public'])
            case['response']['data']['reviews'].append({'reviewId':bad['reviewId'], 'text':bad['text']})
            case['response']['data']['eligibleCount'] += 1
            with self.subTest(review=bad['reviewId']), self.assertRaises(AssertionError):
                validate(case)

    def test_conflicts_cannot_be_changed_to_success(self):
        for name in ('summary_revision_conflict', 'summary_insufficient',
                     'summary_evidence_conflict', 'job_payload_conflict',
                     'job_stale_token', 'job_expired'):
            case = copy.deepcopy(self.cases[name])
            case['response'].pop('error')
            case['response']['data'] = {'status':'succeeded'}
            with self.subTest(name=name), self.assertRaises(AssertionError):
                validate(case)

    def test_unchanged_revision_does_not_override_reduced_eligibility(self):
        case = copy.deepcopy(self.cases['summary_visible'])
        case['state']['reviews'] = case['state']['reviews'][:2]
        with self.assertRaises(AssertionError):
            validate(case)

    def test_retry_wait_claim_obeys_available_at(self):
        case = copy.deepcopy(self.cases['job_claim'])
        case['state']['status'] = 'retry_wait'
        validate(case)
        case['state']['availableAt'] = '2026-09-23T00:00:01Z'
        with self.assertRaises(AssertionError):
            validate(case)

    def test_reclaimed_job_must_issue_new_token(self):
        case = copy.deepcopy(self.cases['job_reclaim'])
        case['response']['data']['job']['leaseToken'] = case['state']['leaseToken']
        with self.assertRaises(AssertionError):
            validate(case)

    def test_succeeded_job_duplicate_stays_succeeded(self):
        case = copy.deepcopy(self.cases['job_duplicate'])
        case['state']['existing']['status'] = 'succeeded'
        case['response']['data']['status'] = 'succeeded'
        validate(case)
        case['response']['data']['status'] = 'queued'
        with self.assertRaises(AssertionError):
            validate(case)


if __name__ == '__main__':
    unittest.main()
