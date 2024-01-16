import { Delay } from "shared/utils/tools";

export async function LoadAnimDict(pDict: string) {
    if (!HasAnimDictLoaded(pDict)) {
        RequestAnimDict(pDict);
        let timeout = false;
        setTimeout(() => timeout = true, 60000);
        while (!HasAnimDictLoaded(pDict) && !timeout) {
            await Delay(10);
        }
    }
}