let sharedConfig: any = require('config.shared');
let InBedDict: string = 'anim@gangops@morgue@table@';
let InBedAnim: string = 'body_search';
let IsInHospitalBed: boolean = false;
let HealAnimDict: string = 'mini@cpr@char_a@cpr_str';
let HealAnim: string = 'cpr_pumpchest';
let EmsNotified: boolean = false;
let CanLeaveBed: boolean = true;
let OnPainKillers: boolean = false;

// Notifies EMS of an injury at a location
// @param coords vector3
// @param text string
RegisterNetEvent('hospital:client:ambulanceAlert', function (coords: Vector3, text: string): void {
    if (GetInvokingResource()) return;
    let [street1, street2] = GetStreetNameAtCoord(coords.x, coords.y, coords.z);
    let street1name: string = GetStreetNameFromHashKey(street1);
    let street2name: string = GetStreetNameFromHashKey(street2);
    exports.qbx_core.Notify({ title: Lang.t('text.alert'), description: text + ' | ' + street1name + ' ' + street2name, type: 'inform' });
    PlaySound(-1, 'Lose_1st', 'GTAO_FM_Events_Soundset', 0, 0, 1);
    let transG: number = 250;
    let blip: number = AddBlipForCoord(coords.x, coords.y, coords.z);
    let blip2: number = AddBlipForCoord(coords.x, coords.y, coords.z);
    let blipText: string = Lang.t('info.ems_alert', { text: text });
    SetBlipSprite(blip, 153);
    SetBlipSprite(blip2, 161);
    SetBlipColour(blip, 1);
    SetBlipColour(blip2, 1);
    SetBlipDisplay(blip, 4);
    SetBlipDisplay(blip2, 8);
    SetBlipAlpha(blip, transG);
    SetBlipAlpha(blip2, transG);
    SetBlipScale(blip, 0.8);
    SetBlipScale(blip2, 2.0);
    SetBlipAsShortRange(blip, false);
    SetBlipAsShortRange(blip2, false);
    PulseBlip(blip2);
    BeginTextCommandSetBlipName('STRING');
    AddTextComponentString(blipText);
    EndTextCommandSetBlipName(blip);
    while (transG !== 0) {
        Wait(720);
        transG -= 1;
        SetBlipAlpha(blip, transG);
        SetBlipAlpha(blip2, transG);
        if (transG === 0) {
            RemoveBlip(blip);
            return;
        }
    }
});

// Revives player, healing all injuries
// Intended to be called from client or server.
RegisterNetEvent('hospital:client:Revive', function (): void {
    if (IsInHospitalBed) {
        lib.requestAnimDict(InBedDict);
        TaskPlayAnim(cache.ped, InBedDict, InBedAnim, 8.0, 1.0, -1, 1, 0, false, false, false);
        SetEntityInvincible(cache.ped, true);
        CanLeaveBed = true;
    }
    EmsNotified = false;
});

// Sends player phone email with hospital bill.
// @param amount number
RegisterNetEvent('hospital:client:SendBillEmail', function (amount: number): void {
    if (GetInvokingResource()) return;
    SetTimeout(Math.random() * (4000 - 2500) + 2500, function (): void {
        let charInfo = QBX.PlayerData.charinfo;
        let gender = charInfo.gender == 1 ? Lang.t('info.mrs') : Lang.t('info.mr');
        TriggerServerEvent('qb-phone:server:sendNewMail', {
            sender: Lang.t('mail.sender'),
            subject: Lang.t('mail.subject'),
            message: Lang.t('mail.message', { gender: gender, lastname: charInfo.lastname, costs: amount }),
            button: {}
        });
    });
});

// Sets blips for stations on the map
CreateThread(function (): void {
    for (let station of sharedConfig.locations.stations) {
        let blip = AddBlipForCoord(station.coords.x, station.coords.y, station.coords.z);
        SetBlipSprite(blip, 61);
        SetBlipAsShortRange(blip, true);
        SetBlipScale(blip, 0.8);
        SetBlipColour(blip, 25);
        BeginTextCommandSetBlipName('STRING');
        AddTextComponentString(station.label);
        EndTextCommandSetBlipName(blip);
    }
});

function GetClosestPlayer(): number {
    return lib.getClosestPlayer(GetEntityCoords(cache.ped), 5.0, false);
}

function OnKeyPress(cb: Function): void {
    if (IsControlJustPressed(0, 38)) {
        lib.hideTextUI();
        cb();
    }
}