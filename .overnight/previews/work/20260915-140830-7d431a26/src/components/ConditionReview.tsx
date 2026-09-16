import type { JoinRequest } from '../types';

export function ConditionReview({
  request,
  userId,
  onRespond,
  onSimulate,
}: {
  request: JoinRequest;
  userId: string;
  onRespond: (revision: number, agree: boolean) => void;
  onSimulate?: (revision: number, agree: boolean) => void;
}) {
  const change = request.reconfirmation;
  if (!change || request.status !== 'reconfirming') return null;
  const isRequester = request.requesterId === userId;
  return (
    <section
      aria-label="변경 조건 확인"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-3 text-left"
    >
      <h3 className="text-xs font-bold text-amber-900">
        신청 후 공고 조건이 변경됐어요
      </h3>
      <p className="text-[11px] leading-relaxed text-amber-900">
        {isRequester
          ? '변경 내용을 확인해 주세요. 동의해도 바로 확정되지는 않으며, 작성자가 수락해야 확정돼요.'
          : '신청자가 아래 조건에 다시 동의할 때까지 수락할 수 없어요. 대화는 계속할 수 있습니다.'}
      </p>
      <div className="space-y-2">
        {change.changes.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white p-3 text-[11px] leading-relaxed"
          >
            <b>{item.label}</b>
            <p className="text-gray-500 mt-1 whitespace-pre-wrap break-words">
              이전: {item.before}
            </p>
            <p className="text-amber-900 mt-1 whitespace-pre-wrap break-words">
              변경: {item.after}
            </p>
          </div>
        ))}
      </div>
      {isRequester ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onRespond(change.revision, false)}
            className="rounded-xl bg-white py-2.5 text-xs text-gray-600"
          >
            변경 거절 · 신청 종료
          </button>
          <button
            onClick={() => onRespond(change.revision, true)}
            className="rounded-xl bg-[#6c2cf5] text-white py-2.5 text-xs font-bold"
          >
            변경 조건에 동의
          </button>
        </div>
      ) : (
        onSimulate && (
          <details className="text-[10px] text-gray-500">
            <summary className="cursor-pointer">신청자 응답 시연</summary>
            <p className="mt-2">
              실제 신청자에게 전달되지 않는 체험 기능이에요.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onSimulate(change.revision, false)}
                className="bg-white rounded-lg p-2"
              >
                신청자 거절 시연
              </button>
              <button
                onClick={() => onSimulate(change.revision, true)}
                className="bg-white rounded-lg p-2 text-[#6c2cf5]"
              >
                신청자 동의 시연
              </button>
            </div>
          </details>
        )
      )}
    </section>
  );
}
