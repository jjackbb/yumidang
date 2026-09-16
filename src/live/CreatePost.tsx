import { useMemo, useState } from 'react';
import { fromKoreaInputValue, koreaInputValue } from '../utils/demoMode';
import { liveApi, POST_CATEGORIES, type Post } from './api';
import { validatePostDraft } from './format';
import { ErrorBox, PrimaryButton, Sheet } from './ui';

const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm';

export function CreatePost({ onClose, onCreated }: { onClose: () => void; onCreated: (post: Post) => void }) {
  // One id per open form: a retried submit returns the same post instead of creating a second one.
  const postId = useMemo(() => crypto.randomUUID(), []);
  const defaults = useMemo(() => {
    const start = new Date(Date.now() + 24 * 3600_000);
    start.setMinutes(0, 0, 0);
    return { starts: koreaInputValue(start), ends: koreaInputValue(new Date(start.getTime() + 2 * 3600_000)) };
  }, []);
  const [form, setForm] = useState({ title: '', category: '전시', description: '', starts: defaults.starts, ends: defaults.ends, recruitment: defaults.starts, publicArea: '', exactLocation: '', preferenceNote: '', tags: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => { setForm(previous => ({ ...previous, [key]: event.target.value })); setError(''); };

  const submit = async () => {
    const draft = {
      title: form.title, description: form.description, category: form.category,
      startsAt: fromKoreaInputValue(form.starts), endsAt: fromKoreaInputValue(form.ends), recruitmentEndsAt: fromKoreaInputValue(form.recruitment),
      publicArea: form.publicArea, exactLocation: form.exactLocation, preferenceNote: form.preferenceNote,
    };
    const problem = validatePostDraft(draft);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      const post = await liveApi.createPost({
        p_post_id: postId, p_title: draft.title.trim(), p_description: draft.description.trim(), p_category: draft.category,
        p_starts_at: draft.startsAt, p_ends_at: draft.endsAt, p_recruitment_ends_at: draft.recruitmentEndsAt,
        p_public_area: draft.publicArea.trim(), p_exact_location: draft.exactLocation.trim(),
        p_preference_note: draft.preferenceNote.trim() || null,
        p_tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      });
      onCreated(post);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return <Sheet label="동행 공고 작성" onClose={onClose}>
    <form noValidate onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-3">
      <label className="block text-xs font-bold">제목<input name="title" value={form.title} maxLength={80} onChange={set('title')} className={inputClass} /></label>
      <label className="block text-xs font-bold">카테고리<select name="category" value={form.category} onChange={set('category')} className={inputClass}>{POST_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
      <label className="block text-xs font-bold">설명<textarea name="description" value={form.description} maxLength={2000} rows={3} onChange={set('description')} className={inputClass} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-bold">시작<input name="starts" type="datetime-local" value={form.starts} onChange={set('starts')} className={inputClass} /></label>
        <label className="block text-xs font-bold">종료<input name="ends" type="datetime-local" value={form.ends} onChange={set('ends')} className={inputClass} /></label>
      </div>
      <label className="block text-xs font-bold">모집 마감<input name="recruitment" type="datetime-local" value={form.recruitment} onChange={set('recruitment')} className={inputClass} /></label>
      <label className="block text-xs font-bold">공개 위치 (시·구·동까지)<input name="publicArea" value={form.publicArea} placeholder="서울특별시 성동구 성수동" onChange={set('publicArea')} className={inputClass} /></label>
      <label className="block text-xs font-bold">정확한 만남 장소 (비공개)<input name="exactLocation" value={form.exactLocation} maxLength={200} placeholder="예: 성수역 3번 출구 앞" onChange={set('exactLocation')} className={inputClass} />
        <span className="block mt-1 font-normal text-[11px] text-gray-400">목록·상세에는 보이지 않고, 동행이 확정된 상대에게만 공개돼요.</span></label>
      <label className="block text-xs font-bold">선호 조건 (선택)<input name="preferenceNote" value={form.preferenceNote} maxLength={300} onChange={set('preferenceNote')} className={inputClass} /></label>
      <label className="block text-xs font-bold">태그 (쉼표로 구분, 최대 5개)<input name="tags" value={form.tags} onChange={set('tags')} className={inputClass} /></label>
      <p className="text-[11px] text-gray-400">정원은 작성자 포함 2명(1:1)이에요. 공고 수정·삭제는 아직 지원하지 않아요.</p>
      {error && <ErrorBox message={error} />}
      <PrimaryButton type="submit" disabled={busy}>{busy ? '등록 중…' : '공고 등록하기'}</PrimaryButton>
    </form>
  </Sheet>;
}
