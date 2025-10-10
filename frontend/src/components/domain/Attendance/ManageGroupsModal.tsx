import React, { useState, useEffect } from 'react';
import { SeatLayoutGroup } from '../../../types/attendance';
import './ManageGroupsModal.css';

interface ManageGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroups: SeatLayoutGroup[];
  onSave: (groups: SeatLayoutGroup[]) => Promise<void>;
}

interface GroupForm {
  id: string;
  name: string;
  rows: number;
  cols: number;
  position: { x: number; y: number };
  isNew?: boolean;
}

export const ManageGroupsModal: React.FC<ManageGroupsModalProps> = ({
  isOpen,
  onClose,
  currentGroups,
  onSave
}) => {
  const [groups, setGroups] = useState<GroupForm[]>(
    currentGroups.map(g => ({ ...g, isNew: false }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // currentGroups가 변경될 때 groups 업데이트
  useEffect(() => {
    if (isOpen && currentGroups.length > 0) {
      setGroups(currentGroups.map(g => ({ ...g, isNew: false })));
    }
  }, [isOpen, currentGroups]);

  if (!isOpen) return null;

  const handleAddGroup = () => {
    const newGroup: GroupForm = {
      id: `group_${Date.now()}`,
      name: `${String.fromCharCode(65 + groups.length)}구역`, // A, B, C...
      rows: 5,
      cols: 5,
      position: { x: 50 + (groups.length * 400), y: 50 },
      isNew: true
    };
    setGroups([...groups, newGroup]);
    setEditingId(newGroup.id);
  };

  const handleUpdateGroup = (id: string, field: keyof GroupForm, value: any) => {
    setGroups(groups.map(g =>
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  const handleDeleteGroup = (id: string) => {
    if (groups.length <= 1) {
      setError('최소 1개의 그룹이 필요합니다');
      return;
    }
    if (!confirm('이 그룹을 삭제하시겠습니까?')) return;
    setGroups(groups.filter(g => g.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMoveGroupUp = (index: number) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];

    // 위치도 자동 조정 (Y축 기준으로 순서대로 배치)
    newGroups.forEach((group, idx) => {
      group.position = { x: 50, y: 50 + (idx * 400) };
    });

    setGroups(newGroups);
  };

  const handleMoveGroupDown = (index: number) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];

    // 위치도 자동 조정 (Y축 기준으로 순서대로 배치)
    newGroups.forEach((group, idx) => {
      group.position = { x: 50, y: 50 + (idx * 400) };
    });

    setGroups(newGroups);
  };

  const handleSave = async () => {
    // 유효성 검사
    for (const group of groups) {
      if (!group.name.trim()) {
        setError('그룹 이름을 입력해주세요');
        return;
      }
      if (group.rows < 1 || group.cols < 1) {
        setError('행과 열은 1 이상이어야 합니다');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const finalGroups: SeatLayoutGroup[] = groups.map(({ isNew, ...g }) => g);
      await onSave(finalGroups);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '그룹 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGroups(currentGroups.map(g => ({ ...g, isNew: false })));
    setEditingId(null);
    setError(null);
    setSaving(false);
    onClose();
  };

  const totalSeats = groups.reduce((sum, g) => sum + (g.rows * g.cols), 0);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content manage-groups-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>그룹 관리</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}

          <div className="groups-list">
            {groups.map((group, index) => (
              <div
                key={group.id}
                className={`group-item ${editingId === group.id ? 'group-item--editing' : ''}`}
              >
                <div className="group-header">
                  <div className="group-order-controls">
                    <button
                      className="btn-order"
                      onClick={() => handleMoveGroupUp(index)}
                      disabled={index === 0}
                      title="위로 이동"
                    >
                      ▲
                    </button>
                    <button
                      className="btn-order"
                      onClick={() => handleMoveGroupDown(index)}
                      disabled={index === groups.length - 1}
                      title="아래로 이동"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => handleUpdateGroup(group.id, 'name', e.target.value)}
                    placeholder="그룹 이름"
                    className="group-name-input"
                    onFocus={() => setEditingId(group.id)}
                  />
                  <button
                    className="btn-delete-group"
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={groups.length <= 1}
                    title="그룹 삭제"
                  >
                    🗑️
                  </button>
                </div>

                <div className="group-config">
                  <div className="config-item">
                    <label>행(Rows)</label>
                    <input
                      type="number"
                      value={group.rows}
                      onChange={(e) => handleUpdateGroup(group.id, 'rows', parseInt(e.target.value) || 1)}
                      min={1}
                      max={20}
                      className="config-input"
                    />
                  </div>
                  <div className="config-item">
                    <label>열(Cols)</label>
                    <input
                      type="number"
                      value={group.cols}
                      onChange={(e) => handleUpdateGroup(group.id, 'cols', parseInt(e.target.value) || 1)}
                      min={1}
                      max={20}
                      className="config-input"
                    />
                  </div>
                  <div className="config-summary">
                    = {group.rows * group.cols}석
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-add-group" onClick={handleAddGroup}>
            + 그룹 추가
          </button>

          <div className="groups-summary">
            <p>총 {groups.length}개 그룹, {totalSeats}개 좌석</p>
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
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageGroupsModal;
