let isEscorting: boolean = false;

// TODO: Change this event name within qb-policejob to be generic
RegisterNetEvent('hospital:client:SetEscortingState');
AddEventHandler('hospital:client:SetEscortingState', (bool: boolean) => {
    isEscorting = bool;
});

// Use first aid pack on the nearest player.
lib.callback.register('hospital:client:UseFirstAid', () => {
    if (isEscorting) {
        exports.qbx_core.Notify(Lang.t('error.impossible'), 'error');
        return;
    }

    const player = GetClosestPlayer();
    if (player) {
        const playerId = GetPlayerServerId(player);
        TriggerServerEvent('hospital:server:UseFirstAid', playerId);
    }
});

lib.callback.register('hospital:client:canHelp', () => {
    return (
        exports.qbx_medical.getLaststand() &&
        exports.qbx_medical.getLaststandTime() <= 300
    );
});

interface HelpPersonEvent {
    targetId: number;
}

RegisterNetEvent('hospital:client:HelpPerson');
const HelpPerson = (event: HelpPersonEvent) => {
    if (GetInvokingResource()) return;

    if (
        lib.progressCircle({
            duration: Math.random() * (60000 - 30000) + 30000,
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
        })
    ) {
        ClearPedTasks(cache.ped);
        exports.qbx_core.Notify(Lang.t('success.revived'), 'success');
        TriggerServerEvent('hospital:server:RevivePlayer', event.targetId);
    } else {
        ClearPedTasks(cache.ped);
        exports.qbx_core.Notify(Lang.t('error.canceled'), 'error');
    }
};