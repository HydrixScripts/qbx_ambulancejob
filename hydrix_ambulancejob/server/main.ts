///@alias source number

// Callback registration for getting player status
lib.callback.register('qbx_ambulancejob:server:getPlayerStatus', function(_: any, targetSrc: SourceNumber): any {
    return exports.qbx_medical:GetPlayerStatus(targetSrc);
  });
  
  // Function to alert ambulance
  function alertAmbulance(src: SourceNumber, text: string): void {
    const ped = GetPlayerPed(src);
    const coords = GetEntityCoords(ped);
    const players = exports.qbx_core:GetQBPlayers();
  
    for (const v of players) {
      if (v.PlayerData.job.name === 'ambulance' && v.PlayerData.job.onduty) {
        TriggerClientEvent('hospital:client:ambulanceAlert', v.PlayerData.source, coords, text);
      }
    }
  }
  
  // Event handler for ambulance alert
  RegisterNetEvent('hospital:server:ambulanceAlert', function(): void {
    if (GetInvokingResource()) return;
    const src: SourceNumber = source;
    alertAmbulance(src, Lang:t('info.civ_down'));
  });
  
  // Event handler for player last stand
  RegisterNetEvent('qbx_medical:server:onPlayerLaststand', function(text: string): void {
    if (GetInvokingResource()) return;
    const src: SourceNumber = source;
    alertAmbulance(src, text);
  });
  
  // Event handler for treating wounds
  RegisterNetEvent('hospital:server:TreatWounds', function(playerId: SourceNumber): void {
    if (GetInvokingResource()) return;
    const src: SourceNumber = source;
    const player = exports.qbx_core:GetPlayer(src);
    const patient = exports.qbx_core:GetPlayer(playerId);
  
    if (player.PlayerData.job.name !== 'ambulance' || !patient) return;
  
    exports.ox_inventory:RemoveItem(src, 'bandage', 1);
    TriggerClientEvent('hospital:client:HealInjuries', patient.PlayerData.source, 'full');
  });
  
  // Event handler for reviving player
  RegisterNetEvent('hospital:server:RevivePlayer', function(playerId: SourceNumber): void {
    if (GetInvokingResource()) return;
    const player = exports.qbx_core:GetPlayer(source);
    const patient = exports.qbx_core:GetPlayer(playerId);
  
    if (!patient) return;
  
    exports.ox_inventory:RemoveItem(player.PlayerData.source, 'firstaid', 1);
    TriggerClientEvent('qbx_medical:client:playerRevived', patient.PlayerData.source);
  });
  
  // Event handler for using first aid
  RegisterNetEvent('hospital:server:UseFirstAid', function(targetId: SourceNumber): void {
    if (GetInvokingResource()) return;
    const src: SourceNumber = source;
    const target = exports.qbx_core:GetPlayer(targetId);
  
    if (!target) return;
  
    const canHelp = lib.callback.await('hospital:client:canHelp', targetId);
  
    if (!canHelp) {
      exports.qbx_core:Notify(src, Lang:t('error.cant_help'), 'error');
      return;
    }
  
    TriggerClientEvent('hospital:client:HelpPerson', src, targetId);
  });
  
  // Callback registration for getting number of doctors
  lib.callback.register('qbx_ambulancejob:server:getNumDoctors', function(): number {
    const count = exports.qbx_core:GetDutyCountType('ems');
    return count;
  });
  
  // Command registration for reporting to EMS
  lib.addCommand('911e', {
    help: Lang:t('info.ems_report'),
    params: [
      { name: 'message', help: Lang:t('info.message_sent'), type: 'string', optional: true },
    ],
  }, function (source: SourceNumber, args: { message?: string }): void {
    const message = args.message || Lang:t('info.civ_call');
    const ped = GetPlayerPed(source);
    const coords = GetEntityCoords(ped);
    const players = exports.qbx_core:GetQBPlayers();
  
    for (const v of players) {
      if (v.PlayerData.job.name === 'ambulance' && v.PlayerData.job.onduty) {
        TriggerClientEvent('hospital:client:ambulanceAlert', v.PlayerData.source, coords, message);
      }
    }
  });
  
  // Function to trigger events on EMS player
  function triggerEventOnEmsPlayer(src: SourceNumber, event: string): void {
    const player = exports.qbx_core:GetPlayer(src);
  
    if (player.PlayerData.job.name !== 'ambulance') {
      exports.qbx_core:Notify(src, Lang:t('error.not_ems'), 'error');
      return;
    }
  
    TriggerClientEvent(event, src);
  }
  
  // Command registration for checking health status
  lib.addCommand('status', {
    help: Lang:t('info.check_health'),
  }, function (source: SourceNumber): void {
    triggerEventOnEmsPlayer(source, 'hospital:client:CheckStatus');
  });
  
  // Command registration for healing player
  lib.addCommand('heal', {
    help: Lang:t('info.heal_player'),
  }, function (source: SourceNumber): void {
    triggerEventOnEmsPlayer(source, 'hospital:client:TreatWounds');
  });
  
  // Command registration for reviving player
  lib.addCommand('revivep', {
    help: Lang:t('info.revive_player'),
  }, function (source: SourceNumber): void {
    triggerEventOnEmsPlayer(source, 'hospital:client:RevivePlayer');
  });
  
  // Item registration for using ifaks
  exports.qbx_core:CreateUseableItem('ifaks', function (source: SourceNumber, item: any): void {
    triggerItemEventOnPlayer(source, item, 'hospital:client:UseIfaks');
  });
  
  // Item registration for using bandage
  exports.qbx_core:CreateUseableItem('bandage', function (source: SourceNumber, item: any): void {
    triggerItemEventOnPlayer(source, item, 'hospital:client:UseBandage');
  });
  
  // Item registration for using painkillers
  exports.qbx_core:CreateUseableItem('painkillers', function (source: SourceNumber, item: any): void {
    triggerItemEventOnPlayer(source, item, 'hospital:client:UsePainkillers');
  });
  
  // Item registration for using firstaid
  exports.qbx_core:CreateUseableItem('firstaid', function (source: SourceNumber, item: any): void {
    triggerItemEventOnPlayer(source, item, 'hospital:client:UseFirstAid');
  });
  
  // Event handler for player death
  RegisterNetEvent('qbx_medical:server:playerDied', function(): void {
    if (GetInvokingResource()) return;
    const src: SourceNumber = source;
    alertAmbulance(src, Lang:t('info.civ_died'));
  });