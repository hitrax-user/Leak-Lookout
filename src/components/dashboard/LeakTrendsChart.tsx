"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LeakedKey } from '@/lib/types';
import { format, parseISO, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

interface LeakTrendsChartProps {
  leaks: LeakedKey[];
  daysToShow?: number;
}

export default function LeakTrendsChart({ leaks, daysToShow = 14 }: LeakTrendsChartProps) {
  const chartData = useMemo(() => {
    // Создаем массив дат для последних N дней
    const today = new Date();
    const dateRange = eachDayOfInterval({
      start: subDays(today, daysToShow - 1),
      end: today
    });

    // Инициализируем данные для графика с нулевыми значениями для всех дней
    const initialData = dateRange.map(date => ({
      date,
      dateStr: format(date, 'dd MMM'),
      new: 0,
      investigating: 0,
      remediated: 0,
      false_positive: 0,
      total: 0
    }));

    // Заполняем данные на основе утечек
    leaks.forEach(leak => {
      try {
        const leakDate = startOfDay(parseISO(leak.detectionTimestamp));
        
        // Находим соответствующий день в наших данных
        const dayData = initialData.find(d => 
          leakDate >= startOfDay(d.date) && 
          leakDate <= endOfDay(d.date)
        );
        
        if (dayData) {
          dayData.total += 1;
          
          // Увеличиваем счетчик для соответствующего статуса
          if (leak.status === 'new' || 
              leak.status === 'enhancing_context' || 
              leak.status === 'validating_key' ||
              leak.status === 'error_enhancing_context' ||
              leak.status === 'error_validating_key') {
            dayData.new += 1;
          } else if (leak.status === 'investigating') {
            dayData.investigating += 1;
          } else if (leak.status === 'remediated') {
            dayData.remediated += 1;
          } else if (leak.status === 'false_positive') {
            dayData.false_positive += 1;
          }
        }
      } catch (error) {
        console.error("Error processing leak date:", error);
      }
    });

    return initialData;
  }, [leaks, daysToShow]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Тенденции утечек</CardTitle>
        <CardDescription>
          Количество обнаруженных утечек за последние {daysToShow} дней
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateStr" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  const formattedName = {
                    'new': 'Новые',
                    'investigating': 'Расследуемые',
                    'remediated': 'Устраненные',
                    'false_positive': 'Ложные срабатывания',
                    'total': 'Всего'
                  }[name] || name;
                  return [value, formattedName];
                }}
              />
              <Legend 
                formatter={(value) => {
                  return {
                    'new': 'Новые',
                    'investigating': 'Расследуемые',
                    'remediated': 'Устраненные',
                    'false_positive': 'Ложные срабатывания',
                    'total': 'Всего'
                  }[value] || value;
                }}
              />
              <Bar dataKey="new" stackId="a" fill="#3b82f6" /> {/* blue-500 */}
              <Bar dataKey="investigating" stackId="a" fill="#eab308" /> {/* yellow-500 */}
              <Bar dataKey="remediated" stackId="a" fill="#22c55e" /> {/* green-500 */}
              <Bar dataKey="false_positive" stackId="a" fill="#94a3b8" /> {/* slate-400 */}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
