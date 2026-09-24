const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(190),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user'
    }
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    defaultScope: {
      attributes: { exclude: ['password_hash'] }
    }
  }
);

const Asset = sequelize.define(
  'Asset',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    estado: {
      type: DataTypes.ENUM('disponible', 'en_uso', 'mantenimiento'),
      allowNull: false,
      defaultValue: 'disponible'
    },
    ubicacion: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: ''
    },
    responsable_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    }
  },
  {
    tableName: 'assets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

const Reservation = sequelize.define(
  'Reservation',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    asset_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: false
    },
    estado_aprobacion: {
      type: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada', 'realizada'),
      allowNull: false,
      defaultValue: 'pendiente'
    }
  },
  {
    tableName: 'reservations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

const MaintenanceLog = sequelize.define(
  'MaintenanceLog',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    asset_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fecha_reporte: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    estado_reparacion: {
      type: DataTypes.ENUM('reportado', 'en_proceso', 'completado'),
      allowNull: false,
      defaultValue: 'reportado'
    }
  },
  {
    tableName: 'maintenance_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

// Asociaciones
User.hasMany(Asset, { as: 'assets', foreignKey: 'responsable_id' });
Asset.belongsTo(User, { as: 'responsable', foreignKey: 'responsable_id' });

User.hasMany(Reservation, { as: 'reservations', foreignKey: 'user_id' });
Reservation.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

Asset.hasMany(Reservation, { as: 'reservations', foreignKey: 'asset_id' });
Reservation.belongsTo(Asset, { as: 'asset', foreignKey: 'asset_id' });

Asset.hasMany(MaintenanceLog, { as: 'maintenanceLogs', foreignKey: 'asset_id' });
MaintenanceLog.belongsTo(Asset, { as: 'asset', foreignKey: 'asset_id' });

module.exports = {
  sequelize,
  User,
  Asset,
  Reservation,
  MaintenanceLog
};