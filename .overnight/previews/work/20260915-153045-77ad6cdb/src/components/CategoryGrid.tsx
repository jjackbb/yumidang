import React from 'react';
import { CategoryItem } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryGridProps {
  categories: CategoryItem[];
  selectedCategory: string | null;
  onSelectCategory: (category: CategoryItem) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section className="px-5 pt-4 pb-24">
      {/* Section Title */}
      <h2 className="text-[18px] font-bold text-gray-900 mb-3.5 tracking-tight">
        어떤 동행을 찾고 계신가요?
      </h2>

      {/* 4-Column Grid of 12 Categories */}
      <div className="grid grid-cols-4 gap-2.5">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              id={`cat-${cat.id}`}
              onClick={() => onSelectCategory(cat)}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-[20px] bg-white transition-all duration-150 active:scale-95 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-[#6c2cf5] shadow-purple-500/10'
                  : 'hover:shadow-md'
              }`}
            >
              {/* Colored Rounded Icon Container */}
              <div
                className={`w-[48px] h-[48px] rounded-[15px] ${cat.iconBg} flex items-center justify-center transition-transform hover:scale-105`}
              >
                <CategoryIcon type={cat.iconType} />
              </div>

              {/* Category Name Label */}
              <span className="text-[13px] font-medium text-gray-800 mt-2 tracking-tight">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
