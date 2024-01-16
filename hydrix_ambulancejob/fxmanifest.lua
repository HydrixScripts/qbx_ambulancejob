fx_version 'cerulean'

description 'qbx_ambulancejob'
author 'Hydrix_Scripts'
version '1.0.0'

lua54 'yes'

use_experimental_fxv2_oal 'yes'

game 'gta5'

shared_scripts {
	'@ox_lib/init.lua',
	'@qbx_core/modules/utils.lua',
	'@qbx_core/shared/locale.lua',
	'locales/en.lua',
	'locales/*.lua',
}

client_scripts {
    '@qbx_core/modules/playerdata.lua',
    'client/*.js',
    'client/*.ts',
}

server_scripts {
    'server/*.js',
    'server/*.ts',
}

files {
	'config/client.lua',
	'config/shared.lua',
}

dependencies {
	'ox_lib',
	'ox_target',
	'ox_inventory',
	'qbx_core',
	'qbx_policejob',
	'qbx_management',
	'qbx_medical',
}