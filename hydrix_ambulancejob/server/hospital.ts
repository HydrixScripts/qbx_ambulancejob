import * as config from 'config.server';
import * as sharedConfig from 'config.shared';
import * as hooks from '@qbx_core.modules.hooks';

let doctorCalled: boolean = false;

interface HospitalBedsTaken {
  [hospitalName: string]: boolean[];
}

const hospitalBedsTaken: HospitalBedsTaken = {};

for (const [hospitalName, hospital] of Object.entries(sharedConfig.locations.hospitals)) {
  hospitalBedsTaken[hospitalName] = new Array(hospital.beds.length).fill(false);
}

function getOpenBed(hospitalName: string): number | undefined {
  const beds = hospitalBedsTaken[hospitalName];
  for (let i = 0; i < beds.length; i++) {
    if (!beds[i]) return i + 1;
  }
}

hooks.callback.register('qbx_ambulancejob:server:getOpenBed', (_, hospitalName: string) => {
  return getOpenBed(hospitalName);
});

interface Player {
  Functions: {
    RemoveMoney: (account: string, amount: number, reason: string) => void;
    ClearInventory: () => void;
  };
  PlayerData: {
    source: number;
    metadata: { injail: number };
  };
}

function billPlayer(player: Player): void {
  player.Functions.RemoveMoney('bank', sharedConfig.checkInCost, 'respawned-at-hospital');
  config.depositSociety('ambulance', sharedConfig.checkInCost);
  TriggerClientEvent('hospital:client:SendBillEmail', player.PlayerData.source, sharedConfig.checkInCost);
}

RegisterNetEvent('qbx_ambulancejob:server:playerEnteredBed', (hospitalName: string, bedIndex: number) => {
  if (GetInvokingResource()) return;
  const src = source;
  const player = exports.qbx_core:GetPlayer(src);
  billPlayer(player);
  hospitalBedsTaken[hospitalName][bedIndex - 1] = true;
});

RegisterNetEvent('qbx_ambulancejob:server:playerLeftBed', (hospitalName: string, bedIndex: number) => {
  if (GetInvokingResource()) return;
  hospitalBedsTaken[hospitalName][bedIndex - 1] = false;
});

RegisterNetEvent('hospital:server:putPlayerInBed', (playerId: number, hospitalName: string, bedIndex: number) => {
  if (GetInvokingResource()) return;
  TriggerClientEvent('qbx_ambulancejob:client:putPlayerInBed', playerId, hospitalName, bedIndex);
});

hooks.callback.register('qbx_ambulancejob:server:isBedTaken', (_, hospitalName: string, bedIndex: number) => {
  return hospitalBedsTaken[hospitalName][bedIndex - 1];
});

function wipeInventory(player: Player): void {
  player.Functions.ClearInventory();
  exports.qbx_core:Notify(player.PlayerData.source, Lang:t('error.possessions_taken'), 'error');
}

hooks.callback.register('qbx_ambulancejob:server:spawnVehicle', (source: number, vehicleName: string, vehicleCoords: any) => {
  const netId = SpawnVehicle(source, vehicleName, vehicleCoords, true);
  return netId;
});

function sendDoctorAlert(): void {
  if (doctorCalled) return;
  doctorCalled = true;
  const [, doctors] = exports.qbx_core:GetDutyCountType('ems');
  for (let i = 0; i < doctors.length; i++) {
    const doctor = doctors[i];
    exports.qbx_core:Notify(doctor, Lang:t('info.dr_needed'), 'inform');
  }

  SetTimeout(config.doctorCallCooldown * 60000, () => {
    doctorCalled = false;
  });
}

function canCheckIn(source: number, hospitalName: string): boolean {
  const numDoctors = exports.qbx_core:GetDutyCountType('ems');
  if (numDoctors >= sharedConfig.minForCheckIn) {
    exports.qbx_core:Notify(source, Lang:t('info.dr_alert'), 'inform');
    sendDoctorAlert();
    return false;
  }

  if (!triggerEventHooks('checkIn', { source, hospitalName })) return false;

  return true;
}

hooks.callback.register('qbx_ambulancejob:server:canCheckIn', canCheckIn);

/**
 * Sends the patient to an open bed within the hospital
 * @param src The player doing the checking in
 * @param patientSrc The player being checked in
 * @param hospitalName The name of the hospital matching the config where the player should be placed
 */

function checkIn(src: number, patientSrc: number, hospitalName: string): boolean {
  if (!canCheckIn(patientSrc, hospitalName)) return false;

  const bedIndex = getOpenBed(hospitalName);
  if (!bedIndex) {
    exports.qbx_core:Notify(src, Lang:t('error.beds_taken'), 'error');
    return false;
  }

  TriggerClientEvent('qbx_ambulancejob:client:checkedIn', patientSrc, hospitalName, bedIndex);
  return true;
}

hooks.callback.register('qbx_ambulancejob:server:checkIn', checkIn);

exports('CheckIn', checkIn);

function respawn(src: number): void {
  const player = exports.qbx_core:GetPlayer(src);
  let closestHospital;
  if (player.PlayerData.metadata.injail > 0) {
    closestHospital = 'jail';
  } else {
    const coords = GetEntityCoords(GetPlayerPed(src));
    let closest = null;

    for (const [hospitalName, hospital] of Object.entries(sharedConfig.locations.hospitals)) {
      if (hospitalName !== 'jail') {
        if (!closest || #(coords - hospital.coords) < #(coords - closest)) {
          closest = hospital.coords;
          closestHospital = hospitalName;
        }
      }
    }
  }

  const bedIndex = getOpenBed(closestHospital);
  if (!bedIndex) {
    exports.qbx_core:Notify(src, Lang:t('error.beds_taken'), 'error');
    return;
  }
  TriggerClientEvent('qbx_ambulancejob:client:checkedIn', src, closestHospital, bedIndex);

  if (config.wipeInvOnRespawn) {
    wipeInventory(player);
  }
}

AddEventHandler('qbx_medical:server:playerRespawned', respawn);