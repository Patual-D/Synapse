const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/models');
const { User, Asset } = require('../src/models');

const SALT_ROUNDS = 10;

async function upsertUser(nombre, email, password, role) {
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      nombre,
      email,
      password_hash: await bcrypt.hash(password, SALT_ROUNDS),
      role
    }
  });
  return { user, created };
}

async function main() {
  await sequelize.authenticate();
  console.log('[SEED] Conectado a la base de datos.');

  const { created: adminCreated } = await upsertUser(
    'Administrador Synapse',
    'admin@synapse.com',
    'Admin123!',
    'admin'
  );
  console.log(`[SEED] Usuario admin: ${adminCreated ? 'creado' : 'ya existía'} (admin@synapse.com / Admin123!)`);

  const { created: userCreated } = await upsertUser(
    'Empleado Demo',
    'empleado@synapse.com',
    'Empleado123!',
    'user'
  );
  console.log(`[SEED] Usuario empleado: ${userCreated ? 'creado' : 'ya existía'} (empleado@synapse.com / Empleado123!)`);

  const user = await User.findOne({ where: { email: 'admin@synapse.com' } });

  const sampleAssets = [
    { nombre: 'Proyector Epson EB-X51', tipo: 'Proyector', estado: 'disponible', ubicacion: 'Sala A' },
    { nombre: 'Laptop HP EliteBook 840', tipo: 'Laptop', estado: 'disponible', ubicacion: 'Oficina 203' },
    { nombre: 'Sala de Juntas Norte', tipo: 'Sala', estado: 'disponible', ubicacion: 'Piso 2' },
    { nombre: 'Camioneta Pickup 2024', tipo: 'Vehículo', estado: 'en_uso', ubicacion: 'Estacionamiento' },
    { nombre: 'Pantalla interactiva 65"', tipo: 'Pantalla', estado: 'mantenimiento', ubicacion: 'Sala C' }
  ];

  for (const assetData of sampleAssets) {
    const [asset, assetCreated] = await Asset.findOrCreate({
      where: { nombre: assetData.nombre },
      defaults: { ...assetData, responsable_id: user.id }
    });
    if (assetCreated) {
      console.log(`[SEED] Activo creado: ${asset.nombre}`);
    }
  }

  console.log('[SEED] Proceso de seed completado.');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('[SEED] Error:', err.message);
  await sequelize.close();
  process.exit(1);
});