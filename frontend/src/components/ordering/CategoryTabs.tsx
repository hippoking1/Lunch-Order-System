import classNames from 'classnames';
import { useStore } from '../../store';
import { CATEGORIES, CATEGORY_ICONS } from '../../constants';

export default function CategoryTabs() {
  const selectedCategory = useStore((s) => s.selectedCategory);
  const setCategory = useStore((s) => s.setCategory);

  return (
    <div className="segmented-control">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={classNames('segmented-item', {
            active: selectedCategory === c,
          })}
          onClick={() => setCategory(c)}
        >
          {CATEGORY_ICONS[c]} {c}
        </button>
      ))}
    </div>
  );
}
