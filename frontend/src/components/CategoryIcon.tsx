import React from 'react';
import {
  Palette,
  PartyPopper,
  Utensils,
  Dumbbell,
  Luggage,
  GraduationCap,
  Footprints,
  BookOpen,
  Ticket,
  ShoppingBag,
  LayoutGrid,
} from 'lucide-react';
import { CategoryItem } from '../types';

interface Props {
  type: CategoryItem['iconType'];
  className?: string;
}

export const CategoryIcon: React.FC<Props> = ({ type, className = 'w-[22px] h-[22px]' }) => {
  const defaultStrokeWidth = 2.2;

  switch (type) {
    case 'exhibition':
      // 전시 - 팔레트
      return <Palette className={`${className} text-[#7c3aed]`} strokeWidth={defaultStrokeWidth} />;

    case 'festival':
      // 축제 - 파티 폭죽
      return <PartyPopper className={`${className} text-[#ff385c]`} strokeWidth={defaultStrokeWidth} />;

    case 'dining':
      // 식사 - 포크와 나이프 식기
      return <Utensils className={`${className} text-[#e68a00]`} strokeWidth={defaultStrokeWidth} />;

    case 'sports':
      // 운동 - 덤벨 / 피트니스
      return <Dumbbell className={`${className} text-[#0284c7]`} strokeWidth={defaultStrokeWidth} />;

    case 'travel':
      // 여행 - 캐리어
      return <Luggage className={`${className} text-[#059669]`} strokeWidth={defaultStrokeWidth} />;

    case 'class':
      // 클래스 - 학사모 / 배움
      return <GraduationCap className={`${className} text-[#6c2cf5]`} strokeWidth={defaultStrokeWidth} />;

    case 'walk':
      // 산책 - 발자국
      return <Footprints className={`${className} text-[#ea580c]`} strokeWidth={defaultStrokeWidth} />;

    case 'study':
      // 스터디 - 펼쳐진 책
      return <BookOpen className={`${className} text-[#0284c7]`} strokeWidth={defaultStrokeWidth} />;

    case 'performance':
      // 공연 - 티켓
      return <Ticket className={`${className} text-[#db2777]`} strokeWidth={defaultStrokeWidth} />;

    case 'shopping':
      // 쇼핑 - 쇼핑백
      return <ShoppingBag className={`${className} text-[#6c2cf5]`} strokeWidth={defaultStrokeWidth} />;

    case 'flash':
      // 지금 - 당!
      return <span className="text-[20px] leading-none font-black tracking-tighter text-[#d97706]">당!</span>;

    case 'other':
      // 기타 - 그리드
      return <LayoutGrid className={`${className} text-[#4b5563]`} strokeWidth={defaultStrokeWidth} />;

    default:
      return null;
  }
};
