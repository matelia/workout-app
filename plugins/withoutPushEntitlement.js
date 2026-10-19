// Listed FIRST in app.json plugins: mods run in reverse order, so this runs after
// expo-notifications has added the entitlement.
// The app only uses *local* notifications. expo-notifications adds the push
// "aps-environment" entitlement, which a free Apple ID (SideStore) can't sign,
// so strip it from the native project.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
