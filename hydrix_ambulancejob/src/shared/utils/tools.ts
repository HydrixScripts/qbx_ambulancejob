export let Delay = (ms: any) => new Promise(res => setTimeout(res, ms));

export const GetRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;
