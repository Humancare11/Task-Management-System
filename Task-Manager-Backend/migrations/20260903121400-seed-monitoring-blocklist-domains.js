"use strict";

/**
 * Starter data for monitoring_blocklist_domains (§5b-1). Conservative, editable
 * later by an admin. A hard-coded constant list in application code is the
 * always-on fallback; this seed just gives operators a visible, tunable table.
 *
 * Idempotent: uses INSERT IGNORE semantics via the UNIQUE(pattern) index, and
 * the down() only removes the exact patterns it inserted.
 */

const ROWS = [
  // banking
  ["*.chase.com", "banking"],
  ["bankofamerica.com", "banking"],
  ["wellsfargo.com", "banking"],
  ["citi.com", "banking"],
  ["capitalone.com", "banking"],
  ["usbank.com", "banking"],
  ["hdfcbank.com", "banking"],
  ["icicibank.com", "banking"],
  ["sbi.co.in", "banking"],
  ["onlinesbi.sbi", "banking"],
  ["axisbank.com", "banking"],
  ["kotak.com", "banking"],
  ["barclays.co.uk", "banking"],
  ["hsbc.com", "banking"],
  ["lloydsbank.com", "banking"],
  // payment
  ["paypal.com", "payment"],
  ["stripe.com", "payment"],
  ["checkout.stripe.com", "payment"],
  ["razorpay.com", "payment"],
  ["phonepe.com", "payment"],
  ["paytm.com", "payment"],
  ["pay.google.com", "payment"],
  ["payments.amazon.com", "payment"],
  ["wise.com", "payment"],
  ["venmo.com", "payment"],
  // health
  ["*.mychart.com", "health"],
  ["healthcare.gov", "health"],
  ["apollo247.com", "health"],
  ["practo.com", "health"],
  ["1mg.com", "health"],
  ["zocdoc.com", "health"],
  // government
  ["*.gov", "government"],
  ["*.gov.in", "government"],
  ["*.gov.uk", "government"],
  ["*.gouv.fr", "government"],
  ["uidai.gov.in", "government"],
  ["incometax.gov.in", "government"],
  ["irs.gov", "government"],
  ["ssa.gov", "government"],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "monitoring_blocklist_domains",
      ROWS.map(([pattern, category]) => ({
        pattern,
        category,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("monitoring_blocklist_domains", {
      pattern: { [Sequelize.Op.in]: ROWS.map(([pattern]) => pattern) },
    });
  },
};
