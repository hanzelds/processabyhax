import { prisma } from './prisma'
import { RecurrenceFrequency } from '@prisma/client'

function calculateNextGenerationAt(frequency: RecurrenceFrequency, advanceDays: number, from: Date = new Date()): Date {
  const d = new Date(from)
  switch (frequency) {
    case 'DIARIO':      d.setDate(d.getDate() + 1); break
    case 'SEMANAL':     d.setDate(d.getDate() + 7); break
    case 'MENSUAL':     d.setMonth(d.getMonth() + 1); break
    case 'TRIMESTRAL':  d.setMonth(d.getMonth() + 3); break
    case 'SEMESTRAL':   d.setMonth(d.getMonth() + 6); break
    case 'ANUAL':       d.setFullYear(d.getFullYear() + 1); break
  }
  d.setDate(d.getDate() - advanceDays)
  return d
}

export async function generateRecurringAdminTasks(): Promise<void> {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const due = await prisma.adminTaskRecurrence.findMany({
    where: { isActive: true, nextGenerationAt: { lte: today } },
  })

  for (const rec of due) {
    // Skip if there's already an open instance
    const openExists = await prisma.adminTask.findFirst({
      where: { recurrenceId: rec.id, status: { notIn: ['COMPLETADA', 'CANCELADA'] } },
    })
    if (openExists) continue

    const dueDate = calculateNextGenerationAt(rec.frequency, rec.advanceDays)
    await prisma.adminTask.create({
      data: {
        title:       rec.title,
        description: rec.description,
        category:    rec.category,
        priority:    rec.priority,
        status:      'PENDIENTE',
        dueDate,
        recurrenceId: rec.id,
        createdById:  rec.createdById,
      },
    })

    await prisma.adminTaskRecurrence.update({
      where: { id: rec.id },
      data: {
        lastGeneratedAt:  today,
        nextGenerationAt: calculateNextGenerationAt(rec.frequency, rec.advanceDays, dueDate),
      },
    })
  }

  if (due.length > 0) {
    console.log(`[AdminTasks Cron] Generadas ${due.length} tarea(s) recurrente(s)`)
  }
}
