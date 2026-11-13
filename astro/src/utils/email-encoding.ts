export function spellOutEmail(address: string): string {
  return address.replace('@', ' [at] ').replaceAll('.', ' [punkt] ');
}

export function encodeEmail(address: string): string {
  return btoa([...address].reverse().join(''));
}

export function decodeEmail(encoded: string): string {
  return [...atob(encoded)].reverse().join('');
}
