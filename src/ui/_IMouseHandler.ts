export type IMouseHandler = {
  MouseIn(event: MouseEvent): void
  MouseOut(event: MouseEvent): void
  MouseDown(event: MouseEvent): void
  MouseUp(event: MouseEvent): void
  MouseMove(event: MouseEvent): void
  MouseWheel(event: WheelEvent): void
}
