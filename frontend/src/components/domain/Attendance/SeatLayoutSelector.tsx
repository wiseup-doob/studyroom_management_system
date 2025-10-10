import React from 'react';
import { SeatLayout } from '../../../types/attendance';
import './SeatLayoutSelector.css';

interface SeatLayoutSelectorProps {
  layouts: SeatLayout[];
  selectedLayoutId: string | null;
  onSelectLayout: (layoutId: string) => void;
  onCreateLayout: () => void;
}

export const SeatLayoutSelector: React.FC<SeatLayoutSelectorProps> = ({
  layouts,
  selectedLayoutId,
  onSelectLayout,
  onCreateLayout
}) => {
  return (
    <div className="seat-layout-selector">
      <div className="seat-layout-selector__header">
        <h3 className="seat-layout-selector__title">좌석 배치도</h3>
        <button
          className="btn btn--small btn--primary"
          onClick={onCreateLayout}
        >
          + 생성
        </button>
      </div>

      <div className="seat-layout-selector__list">
        {layouts.length === 0 ? (
          <div className="seat-layout-selector__empty">
            <p>배치도가 없습니다</p>
            <button
              className="btn btn--secondary btn--small"
              onClick={onCreateLayout}
            >
              첫 배치도 만들기
            </button>
          </div>
        ) : (
          layouts.map(layout => (
            <div
              key={layout.id}
              className={`layout-card ${selectedLayoutId === layout.id ? 'layout-card--selected' : ''}`}
              onClick={() => onSelectLayout(layout.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLayout(layout.id);
                }
              }}
            >
              <div className="layout-card__name">{layout.name}</div>
              <div className="layout-card__info">
                <span className="layout-card__seats">
                  {layout.layout.seats.length}석
                </span>
                {layout.layout.groups && (
                  <span className="layout-card__groups">
                    {layout.layout.groups.length}그룹
                  </span>
                )}
              </div>
              <div className="layout-card__date">
                {new Date(layout.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SeatLayoutSelector;
