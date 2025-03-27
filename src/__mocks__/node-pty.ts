export const spawn = jest.fn();
export type IPty = {
  onData: (callback: (data: string) => void) => void;
  write: (data: string) => void;
  resize: (columns: number, rows: number) => void;
  kill: () => void;
  process: string;
  pid: number;
};
