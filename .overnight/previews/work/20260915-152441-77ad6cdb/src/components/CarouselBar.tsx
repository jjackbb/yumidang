import React, { useEffect, useRef, useState } from 'react';

export function useCarousel(resetKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); ref.current?.scrollTo({ left: 0, behavior: 'instant' }); }, [resetKey]);
  const onScroll = () => {
    const node = ref.current;
    if (!node) return;
    const children = Array.from(node.children) as HTMLElement[];
    const left = node.getBoundingClientRect().left;
    let closest = 0;
    children.forEach((child, i) => {
      if (Math.abs(child.getBoundingClientRect().left - left) < Math.abs(children[closest].getBoundingClientRect().left - left)) closest = i;
    });
    setIndex(closest);
  };
  return { ref, index, onScroll };
}
export function CarouselBar({ count, index, label }: { count: number; index: number; label: string }) {
  if (!count) return null;
  return <div role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}
    className="h-1 w-full overflow-hidden rounded-full bg-gray-200 mt-4">
    <div className="h-full rounded-full bg-[#6c2cf5] transition-transform duration-200" style={{ width: `${100 / count}%`, transform: `translateX(${index * 100}%)` }} />
  </div>;
}
