import classNames from 'classnames';
import { Utensils, CupSoda, CakeSlice } from 'lucide-react';
import { useStore } from '../../store';
import { CATEGORIES } from '../../constants';
import type { Category } from '../../types';

const CATEGORY_ICON_MAP: Record<Category, typeof Utensils> = {
  正餐: Utensils,
  飲料: CupSoda,
  甜點: CakeSlice,
};

export default function CategoryTabs() {
  const selectedCategory = useStore((s) => s.selectedCategory);
  const setCategory = useStore((s) => s.setCategory);

  return (
    <div className="segmented-control">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON_MAP[c];
        return (
          <button
            key={c}
            type="button"
            className={classNames('segmented-item', {
              active: selectedCategory === c,
            })}
            onClick={() => setCategory(c)}
          >
            <Icon size={16} strokeWidth={1.5} />
            {c}
          </button>
        );
      })}
    </div>
  );
}
