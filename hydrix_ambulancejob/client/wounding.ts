let config: any = require('config.client');
let sharedConfig: any = require('config.shared');
let doctorCount: number = 0;

function getDoctorCount(): number {
    return lib.callback.await('qbx_ambulancejob:server:getNumDoctors');
}

function displayRespawnText(): void {
    let deathTime: number = exports.qbx_medical:getDeathTime();
    if (deathTime > 0 && doctorCount > 0) {
        DrawText2D(Lang:t('info.respawn_txt', { deathtime: Math.ceil(deathTime) }), vec2(1.0, 1.44), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
    } else {
        DrawText2D(Lang:t('info.respawn_revive', { holdtime: exports.qbx_medical:getRespawnHoldTimeDeprecated(), cost: sharedConfig.checkInCost }), vec2(1.0, 1.44), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
    }
}

function playDeadAnimation(ped: number): void {
    if (IsInHospitalBed) {
        if (!IsEntityPlayingAnim(ped, InBedDict, InBedAnim, 3)) {
            lib.requestAnimDict(InBedDict);
            TaskPlayAnim(ped, InBedDict, InBedAnim, 1.0, 1.0, -1, 1, 0, false, false, false);
        }
    } else {
        exports.qbx_medical:playDeadAnimation();
    }
}

function handleDead(ped: number): void {
    if (!IsInHospitalBed) {
        displayRespawnText();
    }

    playDeadAnimation(ped);
}

function handleRequestingEms(): void {
    if (!EmsNotified) {
        DrawText2D(Lang:t('info.request_help'), vec2(1.0, 1.40), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
        if (IsControlJustPressed(0, 47)) {
            TriggerServerEvent('hospital:server:ambulanceAlert', Lang:t('info.civ_down'));
            EmsNotified = true;
        }
    } else {
        DrawText2D(Lang:t('info.help_requested'), vec2(1.0, 1.40), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
    }
}

function handleLastStand(): void {
    let laststandTime: number = exports.qbx_medical:getLaststandTime();
    if (laststandTime > config.laststandTimer || doctorCount == 0) {
        DrawText2D(Lang:t('info.bleed_out', { time: Math.ceil(laststandTime) }), vec2(1.0, 1.44), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
    } else {
        DrawText2D(Lang:t('info.bleed_out_help', { time: Math.ceil(laststandTime) }), vec2(1.0, 1.44), 1.0, 1.0, 0.6, 4, 255, 255, 255, 255);
        handleRequestingEms();
    }

    exports.qbx_medical:playLastStandAnimationDeprecated();
}

// Set dead and last stand states.
CreateThread(function (): void {
    while (true) {
        let isDead: boolean = exports.qbx_medical:isDead();
        let inLaststand: boolean = exports.qbx_medical:getLaststand();
        if (isDead || inLaststand) {
            if (isDead) {
                handleDead(cache.ped);
            } else if (inLaststand) {
                handleLastStand();
            }
            Wait(0);
        } else {
            Wait(1000);
        }
    }
});

CreateThread(function (): void {
    while (true) {
        doctorCount = getDoctorCount();
        Wait(60000);
    }
});