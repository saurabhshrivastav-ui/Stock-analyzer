// Debounce: wait until the user stops typing for `wait` ms before running fn.
export function debounce(fn, wait = 300) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);                       // cancel the previous pending call
    timerId = setTimeout(() => fn(...args), wait);
  };
}