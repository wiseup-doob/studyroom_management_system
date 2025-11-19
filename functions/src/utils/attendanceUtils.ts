/**
 * 블럭 그룹화 유틸리티
 * external 타입을 기준으로 연속 블럭 생성
 */

export interface ContinuousBlock {
  slots: any[];
  startTime: string;
  endTime: string;
  subjects: string[];
}

/**
 * 슬롯 배열을 external 기준으로 연속 블럭으로 그룹화
 *
 * @param sortedSlots 시간순 정렬된 슬롯 배열
 * @returns 블럭 배열
 */
export function groupSlotsByExternalBreak(sortedSlots: any[]): ContinuousBlock[] {
  const blocks: ContinuousBlock[] = [];
  let currentBlock: any[] = [];

  for (const slot of sortedSlots) {
    if (slot.type === "class" || slot.type === "self_study") {
      currentBlock.push(slot);
    } else if (slot.type === "external") {
      // external 만나면 현재 블럭 종료
      if (currentBlock.length > 0) {
        blocks.push({
          slots: currentBlock,
          startTime: currentBlock[0].startTime,
          endTime: currentBlock[currentBlock.length - 1].endTime,
          subjects: currentBlock.map((s: any) => s.subject)
        });
        currentBlock = [];
      }
      // external 자체는 블럭에 포함 안 함
    }
  }

  // 마지막 블럭 처리
  if (currentBlock.length > 0) {
    blocks.push({
      slots: currentBlock,
      startTime: currentBlock[0].startTime,
      endTime: currentBlock[currentBlock.length - 1].endTime,
      subjects: currentBlock.map((s: any) => s.subject)
    });
  }

  return blocks;
}
