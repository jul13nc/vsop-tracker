import type { CSSProperties } from "react";
import { chipColor, chipTextColor } from "../domain/chips";
import type { ChipType } from "../types/domain";

interface Props {
  chips: ChipType[];
}

/** Vertical offset in px between two disks of a drawn pile. */
const DISK_OFFSET = 3;

/**
 * Visual starting stack: one drawn pile per configured chip type, colored
 * from the chip config, with the unit value at the center of the top chip.
 * Purely CSS-drawn (no images), sized responsively by theme.css.
 */
export default function ChipStack({ chips }: Props) {
  return (
    <div className="chip-stack">
      {chips.map((chip, index) => {
        const color = chipColor(chip, index);
        const textColor = chipTextColor(color);
        const disks = Math.max(1, chip.count);
        const top = (disks - 1) * DISK_OFFSET;
        return (
          <div key={`${chip.name}-${index}`} className="chip-stack__item">
            <div
              className="chip-pile"
              role="img"
              aria-label={`${disks} jetons ${chip.name} de ${chip.value}`}
              style={
                {
                  "--pile-disks": disks,
                  "--chip": color,
                  "--chip-text": textColor,
                } as CSSProperties
              }
            >
              {Array.from({ length: disks - 1 }, (_, i) => (
                <span
                  key={i}
                  className="chip"
                  style={{ bottom: `${i * DISK_OFFSET}px` }}
                />
              ))}
              <span
                className="chip chip--face"
                style={{ bottom: `${top}px` }}
              >
                {chip.value}
              </span>
            </div>
            <div className="chip-stack__label">
              <strong>×{chip.count} </strong>
              <span className="muted">
                {chip.value * chip.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
