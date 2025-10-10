import React from 'react';
import { SeatLayoutGroup, SeatingChartSeat } from '../../../types/attendance';
import { convertToGroupSeatingGrid } from '../../../utils/attendanceTypeConverters';
import Seat from './Seat';
import './SeatGroup.css';

interface SeatGroupProps {
  group: SeatLayoutGroup;
  seats: SeatingChartSeat[];
  selectedSeatId: string | null;
  onSeatClick: (seatId: string) => void;
}

export const SeatGroup: React.FC<SeatGroupProps> = React.memo(({
  group,
  seats,
  selectedSeatId,
  onSeatClick
}) => {
  // 좌석을 row x col 그리드로 변환
  const grid = convertToGroupSeatingGrid(group, seats);

  return (
    <div className="seat-group">
      <div className="seat-group__header">
        <h4 className="seat-group__name">{group.name}</h4>
        <span className="seat-group__size">{group.rows} × {group.cols}</span>
      </div>

      <div
        className="seat-group__grid"
        style={{
          gridTemplateColumns: `repeat(${group.cols}, 1fr)`,
          gridTemplateRows: `repeat(${group.rows}, 1fr)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((seat, colIndex) => (
            <Seat
              key={seat ? seat.seatLayoutSeat.id : `empty-${rowIndex}-${colIndex}`}
              seat={seat}
              isSelected={seat?.seatLayoutSeat.id === selectedSeatId}
              onClick={() => seat && onSeatClick(seat.seatLayoutSeat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
});

SeatGroup.displayName = 'SeatGroup';

export default SeatGroup;
