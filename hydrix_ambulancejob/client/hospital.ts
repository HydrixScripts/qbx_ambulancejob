// Import necessary modules and types
// Import necessary modules and types
import * as config from 'config.client';
import * as sharedConfig from 'config.shared';

// Define variables with their types
let bedObject: number | null = null;
let bedOccupyingData: any = null; // might want to replace 'any' with a specific type
let cam: number | null = null;
let hospitalOccupying: string | null = null;
let bedIndexOccupying: number | null = null;


// Teleports the player to lie down in bed and sets the player's camera.
async function setBedCam(): Promise<void> {
    DoScreenFadeOut(1000);

    while (!IsScreenFadedOut()) {
        Wait(100);
    }

    if (IsPedDeadOrDying(cache.ped)) {
        const pos = GetEntityCoords(cache.ped, true);
        NetworkResurrectLocalPlayer(pos.x, pos.y, pos.z, GetEntityHeading(cache.ped), true, false);
    }

    bedObject = GetClosestObjectOfType(
        bedOccupyingData.coords.x,
        bedOccupyingData.coords.y,
        bedOccupyingData.coords.z,
        1.0,
        bedOccupyingData.model,
        false,
        false,
        false
    );
    FreezeEntityPosition(bedObject, true);

    SetEntityCoords(cache.ped, bedOccupyingData.coords.x, bedOccupyingData.coords.y, bedOccupyingData.coords.z + 0.02);
    Wait(500);
    FreezeEntityPosition(cache.ped, true);

    lib.requestAnimDict(InBedDict);

    TaskPlayAnim(
        cache.ped,
        InBedDict,
        InBedAnim,
        8.0,
        1.0,
        -1,
        1,
        0,
        false,
        false,
        false
    );
    SetEntityHeading(cache.ped, bedOccupyingData.coords.w);

    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true);
    SetCamActive(cam, true);
    RenderScriptCams(true, false, 1, true, true);
    AttachCamToPedBone(cam, cache.ped, 31085, 0, 1.0, 1.0, true);
    SetCamFov(cam, 90.0);
    let heading = GetEntityHeading(cache.ped);
    heading = heading > 180 ? heading - 180 : heading + 180;
    SetCamRot(cam, -45.0, 0.0, heading, 2);

    DoScreenFadeIn(1000);

    Wait(1000);
    FreezeEntityPosition(cache.ped, true);
}

// Puts the player in bed based on specified parameters
async function putPlayerInBed(hospitalName: string, bedIndex: number, isRevive: boolean, skipOpenCheck: boolean): Promise<void> {
    if (IsInHospitalBed) return;

    if (!skipOpenCheck && lib.callback.await('qbx_ambulancejob:server:isBedTaken', false, hospitalName, bedIndex)) {
        exports.qbx_core.Notify(Lang.t('error.beds_taken'), 'error');
        return;
    }

    hospitalOccupying = hospitalName;
    bedIndexOccupying = bedIndex;
    bedOccupyingData = sharedConfig.locations.hospitals[hospitalName].beds[bedIndex];
    IsInHospitalBed = true;
    exports.qbx_medical.DisableDamageEffects();
    exports.qbx_medical.disableRespawn();
    CanLeaveBed = false;
    await setBedCam();

    CreateThread(async () => {
        Wait(5);
        if (isRevive) {
            exports.qbx_core.Notify(Lang.t('success.being_helped'), 'success');
            Wait(config.aiHealTimer * 1000);
            TriggerEvent('hospital:client:Revive');
        } else {
            CanLeaveBed = true;
        }
    });

    TriggerServerEvent('qbx_ambulancejob:server:playerEnteredBed', hospitalName, bedIndex);
}

// Notifies doctors and puts the player in a hospital bed
async function checkIn(hospitalName: string): Promise<void> {
    const canCheckIn = lib.callback.await('qbx_ambulancejob:server:canCheckIn', false, hospitalName);
    if (!canCheckIn) return;

    exports.scully_emotemenu.playEmoteByCommand('notepad');
    if (lib.progressCircle({
        duration: 2000,
        position: 'bottom',
        label: Lang.t('progress.checking_in'),
        useWhileDead: false,
        canCancel: true,
        disable: {
            move: true,
            car: true,
            combat: true,
            mouse: false,
        },
    })) {
        exports.scully_emotemenu.cancelEmote();
        lib.callback('qbx_ambulancejob:server:checkIn', false, null, cache.serverId, hospitalName);
    } else {
        exports.scully_emotemenu.cancelEmote();
        exports.qbx_core.Notify(Lang.t('error.canceled'), 'error');
    }
}

// Event handler for putting player in bed
onNet('qbx_ambulancejob:client:putPlayerInBed', (hospitalName: string, bedIndex: number) => {
    putPlayerInBed(hospitalName, bedIndex, false, true);
});

// Event handler for player checked in to the hospital
onNet('qbx_ambulancejob:client:checkedIn', (hospitalName: string, bedIndex: number) => {
    putPlayerInBed(hospitalName, bedIndex, true, true);
});

// Set up check-in and getting into beds using either target or zones
if (config.useTarget) {
    CreateThread(() => {
        for (const [hospitalName, hospital] of Object.entries(sharedConfig.locations.hospitals)) {
            if (hospital.checkIn) {
                exports.ox_target.addBoxZone({
                    name: `${hospitalName}_checkin`,
                    coords: hospital.checkIn,
                    size: new vec3(2, 1, 2),
                    rotation: 18,
                    debug: config.debugPoly,
                    options: [
                        {
                            onSelect: () => {
                                checkIn(hospitalName);
                            },
                            icon: 'fas fa-clipboard',
                            label: Lang.t('text.check'),
                            distance: 1.5,
                        },
                    ],
                });
            }

            for (let i = 0; i < hospital.beds.length; i++) {
                const bed = hospital.beds[i];
                exports.ox_target.addBoxZone({
                    name: `${hospitalName}_bed_${i}`,
                    coords: bed.coords.xyz,
                    size: new vec3(1.7, 1.9, 2),
                    rotation: bed.coords.w,
                    debug: config.debugPoly,
                    options: [
                        {
                            onSelect: () => {
                                putPlayerInBed(hospitalName, i, false);
                            },
                            icon: 'fas fa-clipboard',
                            label: Lang.t('text.bed'),
                            distance: 1.5,
                        },
                        {
                            canInteract: () => {
                                return QBX.PlayerData.job.name === 'ambulance';
                            },
                            onSelect: () => {
                                const player = GetClosestPlayer();
                                if (player) {
                                    const playerId = GetPlayerServerId(player);
                                    TriggerServerEvent('hospital:server:putPlayerInBed', playerId, hospitalName, i);
                                }
                            },
                            icon: 'fas fa-clipboard',
                            label: Lang.t('text.put_bed'),
                            distance: 1.5,
                        },
                    ],
                });
            }
        }
    });
} else {
    CreateThread(() => {
        for (const [hospitalName, hospital] of Object.entries(sharedConfig.locations.hospitals)) {
            if (hospital.checkIn) {
                const enterCheckInZone = () => {
                    const numDoctors = lib.callback.await('qbx_ambulancejob:server:getNumDoctors');
                    if (numDoctors >= sharedConfig.minForCheckIn) {
                        lib.showTextUI(Lang.t('text.call_doc'));
                    } else {
                        lib.showTextUI(Lang.t('text.check_in'));
                    }
                };

                const outCheckInZone = () => {
                    lib.hideTextUI();
                };

                const insideCheckInZone = () => {
                    if (IsControlJustPressed(0, 38)) {
                        lib.hideTextUI();
                        checkIn(hospitalName);
                    }
                };

                lib.zones.box({
                    coords: hospital.checkIn,
                    size: new vec3(2, 1, 2),
                    rotation: 18,
                    debug: config.debugPoly,
                    onEnter: enterCheckInZone,
                    onExit: outCheckInZone,
                    inside: insideCheckInZone,
                });
            }

            for (let i = 0; i < hospital.beds.length; i++) {
                const bed = hospital.beds[i];
                const enterBedZone = () => {
                    if (!IsInHospitalBed) {
                        lib.showTextUI(Lang.t('text.lie_bed'));
                    }
                };

                const outBedZone = () => {
                    lib.hideTextUI();
                };

                const insideBedZone = () => {
                    if (IsControlJustPressed(0, 38)) {
                        lib.hideTextUI();
                        putPlayerInBed(hospitalName, i, false);
                    }
                };

                lib.zones.box({
                    coords: bed.coords.xyz,
                    size: new vec3(1.9, 2.1, 2),
                    rotation: bed.coords.w,
                    debug: config.debugPoly,
                    onEnter: enterBedZone,
                    onExit: outBedZone,
                    inside: insideBedZone,
                });
            }
        }
    });
}

const leaveBed = () => {
    lib.requestAnimDict('switch@franklin@bed');
    FreezeEntityPosition(cache.ped, false);
    SetEntityInvincible(cache.ped, false);
    SetEntityHeading(cache.ped, bedOccupyingData.coords.w + 90);
    TaskPlayAnim(cache.ped, 'switch@franklin@bed', 'sleep_getup_rubeyes', 100.0, 1.0, -1, 8, -1, false, false, false);
    Wait(4000);
    ClearPedTasks(cache.ped);
    TriggerServerEvent('qbx_ambulancejob:server:playerLeftBed', hospitalOccupying, bedIndexOccupying);
    FreezeEntityPosition(bedObject, true);
    RenderScriptCams(false, true, 200, true, true);
    DestroyCam(cam, false);

    hospitalOccupying = null;
    bedIndexOccupying = null;
    bedObject = null;
    bedOccupyingData = null;
    IsInHospitalBed = false;
    exports.qbx_medical.EnableDamageEffects();

    if (QBX.PlayerData.metadata.injail <= 0) return;
    TriggerEvent('prison:client:Enter', QBX.PlayerData.metadata.injail);
};

// Shows player option to press key to leave bed when available
CreateThread(() => {
    while (true) {
        if (IsInHospitalBed && CanLeaveBed) {
            lib.showTextUI(Lang.t('text.bed_out'));
            while (IsInHospitalBed && CanLeaveBed) {
                OnKeyPress(leaveBed);
                Wait(0);
            }
            lib.hideTextUI();
        } else {
            Wait(1000);
        }
    }
});

// Reset player settings that the server is storing
const onPlayerUnloaded = () => {
    if (bedIndexOccupying) {
        TriggerServerEvent('qbx_ambulancejob:server:playerLeftBed', hospitalOccupying, bedIndexOccupying);
    }
};

RegisterNetEvent('QBCore:Client:OnPlayerUnload', onPlayerUnloaded);

AddEventHandler('onResourceStop', (resourceName: string) => {
    if (cache.resource !== resourceName) return;
    onPlayerUnloaded();
});