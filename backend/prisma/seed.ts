import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertDemoSeedAllowed } from '../src/shared/demo-seed/demo-seed-guard.js';

const prisma = new PrismaClient();

async function main() {
  assertDemoSeedAllowed(process.env);
  const demoPassword = process.env.DEMO_SEED_PASSWORD?.trim();
  if (!demoPassword || demoPassword.length < 16) {
    throw new Error('Set DEMO_SEED_PASSWORD to a unique value of at least 16 characters in backend/.env.');
  }
  console.warn(
    '⚠️  IRREVERSIBLE: demo seed will DELETE users, clients, time entries and related rows.'
  );
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // Limpar dados existentes
  console.log('🗑️  Limpando dados existentes...');
  await prisma.auditLog.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.clientAllocation.deleteMany();
  await prisma.userClient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.role.deleteMany();

  // Criar roles
  console.log('👥 Criando roles...');
  const adminRole = await prisma.role.create({
    data: { id: 1, name: 'Admin' },
  });

  const managerRole = await prisma.role.create({
    data: { id: 2, name: 'Manager' },
  });

  const consultantRole = await prisma.role.create({
    data: { id: 3, name: 'Consultant' },
  });

  console.log(`   ✓ Admin (ID: ${adminRole.id})`);
  console.log(`   ✓ Manager (ID: ${managerRole.id})`);
  console.log(`   ✓ Consultant (ID: ${consultantRole.id})\n`);

  // Criar usuários
  console.log('👤 Criando usuários...');

  const adminUser = await prisma.user.create({
    data: {
      name: 'Demo Administrator',
      email: 'admin@example.test',
      passwordHash: await bcrypt.hash(demoPassword, 10),
      roleId: 1,
    },
  });
  console.log(`   ✓ Admin: ${adminUser.email}`);

  const managerSeeds = [
    { name: 'Demo Manager 1', email: 'manager1@example.test', isActive: true },
    { name: 'Demo Manager 2', email: 'manager2@example.test', isActive: true },
    { name: 'Demo Manager 3', email: 'manager3@example.test', isActive: true },
  ];

  const managers = [];
  for (const seed of managerSeeds) {
    const manager = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash: await bcrypt.hash(demoPassword, 10),
        roleId: 2,
        isActive: seed.isActive,
      },
    });
    managers.push(manager);
    console.log(`   ✓ Manager: ${manager.email}`);
  }

  const consultantSeeds = [
    { name: 'Demo Consultant 1', email: 'consultant1@example.test', isActive: true },
    { name: 'Demo Consultant 2', email: 'consultant2@example.test', isActive: true },
    { name: 'Demo Consultant 3', email: 'consultant3@example.test', isActive: true },
    { name: 'Demo Consultant 4', email: 'consultant4@example.test', isActive: true },
    { name: 'Demo Consultant 5', email: 'consultant5@example.test', isActive: true },
    { name: 'Demo Consultant 6', email: 'consultant6@example.test', isActive: true },
    { name: 'Demo Consultant 7', email: 'consultant7@example.test', isActive: false },
    { name: 'Demo Consultant 8', email: 'consultant8@example.test', isActive: true },
    { name: 'Demo Consultant 9', email: 'consultant9@example.test', isActive: true },
    { name: 'Demo Consultant 10', email: 'consultant10@example.test', isActive: true },
    { name: 'Demo Consultant 11', email: 'consultant11@example.test', isActive: true },
    { name: 'Demo Consultant 12', email: 'consultant12@example.test', isActive: false },
  ];

  const consultants = [];
  for (let i = 0; i < consultantSeeds.length; i += 1) {
    const manager = managers[i % managers.length];
    const seed = consultantSeeds[i];
    const consultant = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash: await bcrypt.hash(demoPassword, 10),
        roleId: 3,
        managerId: manager.id,
        isActive: seed.isActive,
      },
    });
    consultants.push(consultant);
    console.log(`   ✓ Consultant: ${consultant.email}`);
  }
  console.log('');

  // Criar clientes
  console.log('🏢 Criando clientes...');

  const clientSeeds = [
    { name: 'Example Client A', code: 'CLIENT-A', lockDay: 2, paysOvertime: true, isActive: true },
    { name: 'Example Client B', code: 'CLIENT-B', lockDay: 5, paysOvertime: false, isActive: true },
    { name: 'Example Client C', code: 'CLIENT-C', lockDay: 10, paysOvertime: true, isActive: true },
    { name: 'Example Client D', code: 'CLIENT-D', lockDay: null, paysOvertime: true, isActive: true },
    { name: 'Example Client E', code: 'CLIENT-E', lockDay: 15, paysOvertime: false, isActive: false },
    { name: 'Example Client F', code: 'CLIENT-F', lockDay: 20, paysOvertime: true, isActive: true },
    { name: 'Example Client G', code: 'CLIENT-G', lockDay: null, paysOvertime: true, isActive: true },
    { name: 'Example Client H', code: 'CLIENT-H', lockDay: 25, paysOvertime: false, isActive: false },
    { name: 'Example Client I', code: 'CLIENT-I', lockDay: 28, paysOvertime: true, isActive: true },
    { name: 'Example Client J', code: 'CLIENT-J', lockDay: null, paysOvertime: true, isActive: true },
  ];

  const clients = [];
  for (const seed of clientSeeds) {
    const client = await prisma.client.create({
      data: {
        name: seed.name,
        code: seed.code,
        lockDay: seed.lockDay,
        paysOvertime: seed.paysOvertime,
        isActive: seed.isActive,
      },
    });
    clients.push(client);
    console.log(
      `   ✓ ${client.name} (${client.code})${client.lockDay ? ` lockDay=${client.lockDay}` : ''}`
    );
  }
  console.log('');

  // Vincular usuários a clientes
  console.log('🔗 Vinculando usuários a clientes...');

  for (const manager of managers) {
    const selected = clients.slice(0, 3);
    for (const client of selected) {
      await prisma.userClient.create({
        data: { userId: manager.id, clientId: client.id },
      });
      console.log(`   ✓ ${manager.name} → ${client.name}`);
    }
  }

  for (const consultant of consultants) {
    const startIndex = consultant.id % clients.length;
    const selected = [
      clients[startIndex % clients.length],
      clients[(startIndex + 2) % clients.length],
      clients[(startIndex + 4) % clients.length],
    ];
    for (const client of selected) {
      await prisma.userClient.create({
        data: { userId: consultant.id, clientId: client.id },
      });
      console.log(`   ✓ ${consultant.name} → ${client.name}`);
    }
  }
  console.log('');

  console.log('📌 Criando alocacoes de horas...');
  for (const consultant of consultants) {
    const assignedClients = await prisma.userClient.findMany({
      where: { userId: consultant.id },
      select: { clientId: true },
      take: 2,
    });
    for (const [index, link] of assignedClients.entries()) {
      if (index % 2 === 0) {
        await prisma.clientAllocation.create({
          data: {
            userId: consultant.id,
            clientId: link.clientId,
            allocationType: 'DAILY',
            hoursPerDay: 4 + (consultant.id % 3),
          },
        });
      } else {
        await prisma.clientAllocation.create({
          data: {
            userId: consultant.id,
            clientId: link.clientId,
            allocationType: 'MONTHLY',
            hoursPerMonth: 40 + (consultant.id % 4) * 10,
          },
        });
      }
    }
  }
  console.log('   ✓ Alocacoes criadas');
  console.log('');

  // Criar lançamentos de horas
  console.log('⏰ Criando lançamentos de horas...');

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const activities = [
    'Desenvolvimento de API REST',
    'Testes unitarios',
    'Reuniao com cliente',
    'Implementacao de features',
    'Analise de requisitos',
    'Desenvolvimento frontend',
    'Correcao de bugs',
    'Documentacao',
    'Planejamento tecnico',
    'Code review',
    'Refatoracao',
    'Monitoramento',
  ];
  const managerActivities = [
    'Gestao de equipe',
    'Alinhamento com stakeholders',
    'Planejamento de sprint',
    'Revisao de backlog',
    'Analise de indicadores',
    'Status report',
    'Gestao de riscos',
    'Reuniao de acompanhamento',
    'Priorizacao de demandas',
    'Gestao de capacidade',
  ];
  const durations = [60, 90, 120, 180, 240, 300, 360, 420, 480];

  const allUsers = [...consultants, ...managers];
  let entryCount = 0;

  for (const user of allUsers) {
    const links = await prisma.userClient.findMany({
      where: { userId: user.id },
      select: { clientId: true },
    });
    const userClientIds = links.map((link) => link.clientId);
    if (userClientIds.length === 0) continue;

    for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
      const month = currentMonth - monthOffset;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const normalizedMonth = (month + 12) % 12;
      for (let day = 1; day <= 20; day += 2) {
        const clientId = userClientIds[(user.id + day + monthOffset) % userClientIds.length];
        const activityPool = user.roleId === 2 ? managerActivities : activities;
        const activity = activityPool[(user.id + day + monthOffset) % activityPool.length];
        const durationMinutes = durations[(user.id + day) % durations.length];
        const date = new Date(year, normalizedMonth, day);

        await prisma.timeEntry.create({
          data: {
            userId: user.id,
            clientId,
            date,
            activityDescription: activity,
            durationMinutes,
          },
        });
        await prisma.activityTag.upsert({
          where: { userId_name: { userId: user.id, name: activity } },
          update: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
          create: {
            userId: user.id,
            name: activity,
            usageCount: 1,
            lastUsedAt: new Date(),
          },
        });
        entryCount += 1;
      }
    }
  }

  console.log(`   ✓ ${entryCount} lançamentos criados`);

  console.log('\n⚡ Criando exemplos de horas extras (pool mensal)...');
  const overtimeConsultant = consultants[0];
  if (overtimeConsultant) {
    const overtimeLinks = await prisma.userClient.findMany({
      where: { userId: overtimeConsultant.id },
      select: { clientId: true },
      take: 2,
    });
    const overtimeClientIds = overtimeLinks.map((link) => link.clientId);
    if (overtimeClientIds.length > 0) {
      const workingDays: Date[] = [];
      const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let day = 1; day <= totalDays; day += 1) {
        const date = new Date(currentYear, currentMonth, day);
        const weekday = date.getDay();
        if (weekday >= 1 && weekday <= 5) workingDays.push(date);
      }

      let overtimeEntries = 0;
      for (const [index, date] of workingDays.entries()) {
        const clientId = overtimeClientIds[index % overtimeClientIds.length];
        await prisma.timeEntry.create({
          data: {
            userId: overtimeConsultant.id,
            clientId,
            date,
            activityDescription: 'Hora extra planejada',
            durationMinutes: 420,
          },
        });
        overtimeEntries += 1;
      }
      console.log(
        `   ✓ ${overtimeEntries} lançamentos extras para ${overtimeConsultant.name} no mês atual`
      );
    } else {
      console.log('   • Consultor selecionado sem clientes vinculados. Pulando extras.');
    }
  } else {
    console.log('   • Nenhum consultor encontrado para gerar extras.');
  }

  console.log('\n✅ Seed concluído com sucesso!\n');

  // Exibir resumo
  console.log('📊 Resumo do banco:');
  const userCount = await prisma.user.count();
  const clientCount = await prisma.client.count();
  const timeEntryCount = await prisma.timeEntry.count();

  console.log(`   • Usuários: ${userCount}`);
  console.log(`   • Clientes: ${clientCount}`);
  console.log(`   • Lançamentos de horas: ${timeEntryCount}\n`);

  console.log('\n🔐 Demo accounts are ready. Use DEMO_SEED_PASSWORD from backend/.env to sign in.');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
