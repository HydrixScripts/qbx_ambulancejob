import * as config from 'config.client';
import * as sharedConfig from 'config.shared';

let checkVehicle: boolean = false;
const WEAPONS = exports.qbx_core.GetWeapons();

interface VehicleData {
    vehicleName: string;
    vehiclePlatePrefix: string;
    coords: vector4;
}

function takeOutVehicle(data: VehicleData): void {
    const netId = lib.callback.await('qbx_ambulancejob:server:spawnVehicle', false, data.vehicleName, data.coords);
    let timeout = 100;
    while (!NetworkDoesEntityExistWithNetworkId(netId) && timeout > 0) {
        Wait(10);
        timeout -= 1;
    }
    const veh = NetworkGetEntityFromNetworkId(netId);
    SetVehicleNumberPlateText(veh, data.vehiclePlatePrefix + String(Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000));
    TriggerEvent('vehiclekeys:client:SetOwner', GetPlate(veh));
    SetVehicleEngineOn(veh, true, true, true);

    const settings = config.vehicleSettings[data.vehicleName];
    if (!settings) return;

    if (settings.extras) {
        SetVehicleExtra(veh, settings.extras);
    }

    if (settings.livery) {
        SetVehicleLivery(veh, settings.livery);
    }
}

function showGarageMenu(vehicles: AuthorizedVehicles, vehiclePlatePrefix: string, coords: vector4): void {
    const authorizedVehicles = vehicles[QBX.PlayerData.job.grade.level];
    const optionsMenu: any[] = [];
    for (const veh in authorizedVehicles) {
        optionsMenu.push({
            title: authorizedVehicles[veh],
            onSelect: takeOutVehicle,
            args: {
                vehicleName: veh,
                vehiclePlatePrefix: vehiclePlatePrefix,
                coords: coords,
            },
        });
    }

    lib.registerContext({
        id: 'ambulance_garage_context_menu',
        title: Lang.t('menu.amb_vehicles'),
        options: optionsMenu,
    });
    lib.showContext('ambulance_garage_context_menu');
}

function showTreatmentMenu(status: string[]): void {
    const statusMenu: any[] = [];
    for (let i = 0; i < status.length; i++) {
        statusMenu[i] = {
            title: status[i],
            event: 'hospital:client:TreatWounds',
        };
    }

    lib.registerContext({
        id: 'ambulance_status_context_menu',
        title: Lang.t('menu.status'),
        options: statusMenu,
    });
    lib.showContext('ambulance_status_context_menu');
}

function checkStatus(): void {
    const player = GetClosestPlayer();
    if (!player) {
        exports.qbx_core.Notify(Lang.t('error.no_player'), 'error');
        return;
    }
    const playerId = GetPlayerServerId(player);

    const status = lib.callback.await('qbx_ambulancejob:server:getPlayerStatus', false, playerId);
    if (status.injuries.length === 0) {
        exports.qbx_core.Notify(Lang.t('success.healthy_player'), 'success');
        return;
    }

    for (const hash in status.damageCauses) {
        TriggerEvent('chat:addMessage', {
            color: [255, 0, 0],
            multiline: false,
            args: [Lang.t('info.status'), WEAPONS[hash].damagereason],
        });
    }

    if (status.bleedLevel > 0) {
        TriggerEvent('chat:addMessage', {
            color: [255, 0, 0],
            multiline: false,
            args: [Lang.t('info.status'), Lang.t('info.is_status', { status: status.bleedState })],
        });
    }

    showTreatmentMenu(status.injuries);
}

function revivePlayer(): void {
    const hasFirstAid = exports.ox_inventory.Search('count', 'firstaid') > 0;
    if (!hasFirstAid) {
        exports.qbx_core.Notify(Lang.t('error.no_firstaid'), 'error');
        return;
    }

    const player = GetClosestPlayer();
    if (!player) {
        exports.qbx_core.Notify(Lang.t('error.no_player'), 'error');
        return;
    }

    if (lib.progressCircle({
        duration: 5000,
        position: 'bottom',
        label: Lang.t('progress.revive'),
        useWhileDead: false,
        canCancel: true,
        disable: {
            move: false,
            car: false,
            combat: true,
            mouse: false,
        },
        anim: {
            dict: HealAnimDict,
            clip: HealAnim,
        },
    })) {
        StopAnimTask(cache.ped, HealAnimDict, 'exit', 1.0);
        exports.qbx_core.Notify(Lang.t('success.revived'), 'success');
        TriggerServerEvent('hospital:server:RevivePlayer', GetPlayerServerId(player));
    } else {
        StopAnimTask(cache.ped, HealAnimDict, 'exit', 1.0);
        exports.qbx_core.Notify(Lang.t('error.canceled'), 'error');
    }
}

function treatWounds(): void {
    const hasBandage = exports.ox_inventory.Search('count', 'bandage') > 0;
    if (!hasBandage) {
        exports.qbx_core.Notify(Lang.t('error.no_bandage'), 'error');
        return;
    }

    const player = GetClosestPlayer();
    if (!player) {
        exports.qbx_core.Notify(Lang.t('error.no_player'), 'error');
        return;
    }

    if (lib.progressCircle({
        duration: 5000,
        position: 'bottom',
        label: Lang.t('progress.healing'),
        useWhileDead: false,
        canCancel: true,
        disable: {
            move: false,
            car: false,
            combat: true,
            mouse: false,
        },
        anim: {
            dict: HealAnimDict,
            clip: HealAnim,
        },
    })) {
        StopAnimTask(cache.ped, HealAnimDict, 'exit', 1.0);
        exports.qbx_core.Notify(Lang.t('success.helped_player'), 'success');
        TriggerServerEvent('hospital:server:TreatWounds', GetPlayerServerId(player));
    } else {
        StopAnimTask(cache.ped, HealAnimDict, 'exit', 1.0);
        exports.qbx_core.Notify(Lang.t('error.canceled'), 'error');
    }
}

function openStash(): void {
    if (!QBX.PlayerData.job.onduty) return;
    TriggerServerEvent('inventory:server:OpenInventory', 'stash', 'ambulancestash_' + QBX.PlayerData.citizenid);
    TriggerEvent('inventory:client:SetCurrentStash', 'ambulancestash_' + QBX.PlayerData.citizenid);
}

function openArmory(): void {
    if (QBX.PlayerData.job.onduty) {
        TriggerServerEvent('inventory:server:OpenInventory', 'shop', 'hospital', config.items);
    }
}

function checkGarageAction(vehicles: AuthorizedVehicles, vehiclePlatePrefix: string, coords: vector4): void {
    checkVehicle = true;
    CreateThread(() => {
        while (checkVehicle) {
            if (IsControlJustPressed(0, 38)) {
                lib.hideTextUI();
                checkVehicle = false;
                if (cache.vehicle) {
                    DeleteEntity(cache.vehicle);
                } else {
                    showGarageMenu(vehicles, vehiclePlatePrefix, coords);
                }
            }
            Wait(0);
        }
    });
}

function teleportPlayerWithFade(coords: vector4): void {
    DoScreenFadeOut(500);
    while (!IsScreenFadedOut()) {
        Wait(10);
    }

    SetEntityCoords(cache.ped, coords.x, coords.y, coords.z, false, false, false, false);
    SetEntityHeading(cache.ped, coords.w);

    Wait(100);

    DoScreenFadeIn(1000);
}

function teleportToMainElevator(): void {
    teleportPlayerWithFade(sharedConfig.locations.main[1]);
}

function teleportToRoofElevator(): void {
    teleportPlayerWithFade(sharedConfig.locations.roof[1]);
}

function toggleDuty(): void {
    TriggerServerEvent('QBCore:ToggleDuty');
    TriggerServerEvent('police:server:UpdateBlips');
}

function createGarage(vehicles: AuthorizedVehicles, vehiclePlatePrefix: string, coords: vector4): void {
    function inVehicleZone(): void {
        if (QBX.PlayerData.job.name === 'ambulance' && QBX.PlayerData.job.onduty) {
            lib.showTextUI(Lang.t('text.veh_button'));
            checkGarageAction(vehicles, vehiclePlatePrefix, coords);
        } else {
            checkVehicle = false;
            lib.hideTextUI();
        }
    }

    function outVehicleZone(): void {
        checkVehicle = false;
        lib.hideTextUI();
    }

    lib.zones.box({
        coords: coords.xyz,
        size: vec3(5, 5, 2),
        rotation: coords.w,
        debug: config.debugPoly,
        inside: inVehicleZone,
        onExit: outVehicleZone,
    });
}

CreateThread(() => {
    for (const coords of sharedConfig.locations.vehicle) {
        createGarage(config.authorizedVehicles, Lang.t('info.amb_plate'), coords);
    }

    for (const coords of sharedConfig.locations.helicopter) {
        createGarage(config.authorizedHelicopters, Lang.t('info.heli_plate'), coords);
    }
});

if (config.useTarget) {
    CreateThread(() => {
        for (let i = 1; i <= sharedConfig.locations.duty.length; i++) {
            exports.ox_target.addBoxZone({
                name: 'duty' + i,
                coords: sharedConfig.locations.duty[i - 1],
                size: vec3(1.5, 1, 2),
                rotation: 71,
                debug: config.debugPoly,
                options: [{
                    type: 'client',
                    onSelect: toggleDuty,
                    icon: 'fa fa-clipboard',
                    label: Lang.t('text.duty'),
                    distance: 2,
                    groups: 'ambulance',
                }],
            });
        }

        for (let i = 1; i <= sharedConfig.locations.stash.length; i++) {
            exports.ox_target.addBoxZone({
                name: 'stash' + i,
                coords: sharedConfig.locations.stash[i - 1],
                size: vec3(1, 1, 2),
                rotation: -20,
                debug: config.debugPoly,
                options: [{
                    type: 'client',
                    onSelect: openStash,
                    icon: 'fa fa-clipboard',
                    label: Lang.t('text.pstash'),
                    distance: 2,
                    groups: 'ambulance',
                }],
            });
        }

        for (let i = 1; i <= sharedConfig.locations.armory.length; i++) {
            exports.ox_target.addBoxZone({
                name: 'armory' + i,
                coords: sharedConfig.locations.armory[i - 1],
                size: vec3(1, 1, 2),
                rotation: -20,
                debug: config.debugPoly,
                options: [{
                    type: 'client',
                    onSelect: openArmory,
                    icon: 'fa fa-clipboard',
                    label: Lang.t('text.armory'),
                    distance: 1.5,
                    groups: 'ambulance',
                }],
            });
        }

        exports.ox_target.addBoxZone({
            name: 'roof1',
            coords: sharedConfig.locations.roof[0],
            size: vec3(1, 2, 2),
            rotation: -20,
            debug: config.debugPoly,
            options: [{
                type: 'client',
                onSelect: teleportToMainElevator,
                icon: 'fas fa-hand-point-down',
                label: Lang.t('text.el_main'),
                distance: 1.5,
                groups: 'ambulance',
            }],
        });

        exports.ox_target.addBoxZone({
            name: 'main1',
            coords: sharedConfig.locations.main[0],
            size: vec3(2, 1, 2),
            rotation: -20,
            debug: config.debugPoly,
            options: [{
                type: 'client',
                onSelect: teleportToRoofElevator,
                icon: 'fas fa-hand-point-up',
                label: Lang.t('text.el_roof'),
                distance: 1.5,
                groups: 'ambulance',
            }],
        });
    });
} else {
    CreateThread(() => {
        for (let i = 1; i <= sharedConfig.locations.duty.length; i++) {
          const enteredSignInZone = (): void => {
            if (!QBX.PlayerData.job.onduty) {
              lib.showTextUI(Lang.t('text.onduty_button'));
            } else {
              lib.showTextUI(Lang.t('text.offduty_button'));
            }
          };
    
          const outSignInZone = (): void => {
            lib.hideTextUI();
          };
    
          const insideDutyZone = (): void => {
            OnKeyPress(toggleDuty);
          };
    
          lib.zones.box({
            coords: sharedConfig.locations.duty[i - 1],
            size: vec3(1, 1, 2),
            rotation: -20,
            debug: config.debugPoly,
            onEnter: enteredSignInZone,
            onExit: outSignInZone,
            inside: insideDutyZone,
          });
        }
    
        for (let i = 1; i <= sharedConfig.locations.stash.length; i++) {
          const enteredStashZone = (): void => {
            if (QBX.PlayerData.job.onduty) {
              lib.showTextUI(Lang.t('text.pstash_button'));
            }
          };
    
          const outStashZone = (): void => {
            lib.hideTextUI();
          };
    
          const insideStashZone = (): void => {
            OnKeyPress(openStash);
          };
    
          lib.zones.box({
            coords: sharedConfig.locations.stash[i],
            size: vec3(1, 1, 2),
            rotation: -20,
            debug: config.debugPoly,
            onEnter: enteredStashZone,
            onExit: outStashZone,
            inside: insideStashZone,
          });
        }
    
        // Repeat the pattern for other sections...
    
        const enteredMainZone = (): void => {
          if (QBX.PlayerData.job.onduty) {
            lib.showTextUI(Lang.t('text.elevator_roof'));
          } else {
            lib.showTextUI(Lang.t('error.not_ems'));
          }
        };
    
        const outMainZone = (): void => {
          lib.hideTextUI();
        };
    
        const insideMainZone = (): void => {
          OnKeyPress(teleportToRoofElevator);
        };
    
        lib.zones.box({
          coords: sharedConfig.locations.main[1],
          size: vec3(1, 1, 2),
          rotation: -20,
          debug: config.debugPoly,
          onEnter: enteredMainZone,
          onExit: outMainZone,
          inside: insideMainZone,
        });
      });
    } else {
      // Handle the else case...
    }