"use strict";

/**
 * monitoring_content_events — §5b captured search terms / AI prompts, stored
 * SEPARATELY from all other monitoring metadata and EXTRA-ENCRYPTED
 * (AES-256-GCM, versioned keys — see utils/contentCrypto.js).
 *
 * Built in Phase 0 because schema changes here are painful later; completely
 * inert until Phase 4. There is deliberately NO plaintext column. Retention is
 * enforced by a daily job that hard-deletes rows past expires_at
 * (org.content_retention_days, default 30, max 90).
 *
 * key_version selects the decryption key from the registry, so key rotation
 * never strands old rows.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_content_events", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      agent_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "monitoring_agents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      app: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      kind: {
        type: Sequelize.ENUM("search", "prompt"),
        allowNull: false,
      },
      domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      // AES-256-GCM ciphertext of the captured text (UTF-8).
      ciphertext: {
        type: Sequelize.BLOB,
        allowNull: false,
      },
      iv: {
        type: Sequelize.BLOB("tiny"),
        allowNull: false,
      },
      auth_tag: {
        type: Sequelize.BLOB("tiny"),
        allowNull: false,
      },
      key_version: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },

      // Best-effort capture method (UIA today). See §8 — selectors can break
      // silently when a target web app updates.
      source: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "uia",
      },

      captured_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_content_events", {
      fields: ["user_id", "captured_at"],
      name: "ix_monitoring_content_events_user_captured",
    });
    await queryInterface.addIndex("monitoring_content_events", {
      fields: ["expires_at"],
      name: "ix_monitoring_content_events_expires_at",
    });
    await queryInterface.addIndex("monitoring_content_events", {
      fields: ["organization_id", "captured_at"],
      name: "ix_monitoring_content_events_org_captured",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_content_events");
  },
};
