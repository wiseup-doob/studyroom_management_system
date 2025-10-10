import React, { useState } from 'react';
import { CreateSeatLayoutData, SeatLayoutGroup, SeatLayoutSeat } from '../../../types/attendance';
import './CreateSeatLayoutModal.css';

interface CreateSeatLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateSeatLayoutData) => Promise<void>;
}

interface GroupConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
  position: { x: number; y: number };
}

export const CreateSeatLayoutModal: React.FC<CreateSeatLayoutModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('A구역');
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('배치도 이름을 입력해주세요');
      return;
    }

    if (rows < 1 || cols < 1) {
      setError('행과 열은 1 이상이어야 합니다');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 그룹 생성
      const group: SeatLayoutGroup = {
        id: `group_${Date.now()}`,
        name: groupName,
        rows,
        cols,
        position: { x: 50, y: 50 }
      };

      // 좌석 생성
      const seats: SeatLayoutSeat[] = [];
      const seatWidth = 60;
      const seatHeight = 60;
      const seatGap = 10;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const seatNumber = row * cols + col + 1;
          seats.push({
            id: `${group.id}_seat_${row}_${col}`,
            position: {
              x: group.position.x + col * (seatWidth + seatGap),
              y: group.position.y + row * (seatHeight + seatGap)
            },
            size: { width: seatWidth, height: seatHeight },
            groupId: group.id,
            row,
            col,
            label: `${groupName}-${seatNumber}`
          });
        }
      }

      // dimensions 계산
      const dimensions = {
        width: group.position.x + (cols * (seatWidth + seatGap)) + 50,
        height: group.position.y + (rows * (seatHeight + seatGap)) + 50
      };

      const layoutData: CreateSeatLayoutData = {
        name: name.trim(),
        layout: {
          groups: [group],
          seats,
          dimensions
        }
      };

      await onSave(layoutData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '배치도 생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setGroupName('A구역');
    setRows(5);
    setCols(5);
    setError(null);
    setSaving(false);
    onClose();
  };

  const totalSeats = rows * cols;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>좌석 배치도 생성</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="layout-name">배치도 이름 *</label>
            <input
              id="layout-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 1층 자습실"
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-name">그룹 이름</label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="예: A구역"
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rows">행(Rows) 개수 *</label>
              <input
                id="rows"
                type="number"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                min={1}
                max={20}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cols">열(Cols) 개수 *</label>
              <input
                id="cols"
                type="number"
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                min={1}
                max={20}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-summary">
            <p className="summary-text">
              총 <strong>{rows} × {cols} = {totalSeats}개</strong> 좌석이 생성됩니다
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSeatLayoutModal;
