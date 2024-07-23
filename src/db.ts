/// <reference lib='deno.unstable' />
export const database = await Deno.openKv('./rooms.sqlite')
