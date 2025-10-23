import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { TComp, type GridSchema } from './TComp';

interface SampleRow {
  id: string;
  type: string;
  task: string;
  quantity: number;
  unit: string;
  price: number;
  date: Date;
  active: boolean;
  phase: 'design' | 'build' | 'test';
}

const baseRows: SampleRow[] = [
  {
    id: 'LI-1001',
    type: 'Material',
    task: 'DC Cable 4mm',
    quantity: 120,
    unit: 'm',
    price: 1.25,
    date: new Date(2024, 0, 5),
    active: true,
    phase: 'design'
  },
  {
    id: 'LI-1002',
    type: 'Material',
    task: 'AC Cable 6mm',
    quantity: 75,
    unit: 'm',
    price: 1.95,
    date: new Date(2024, 0, 6),
    active: false,
    phase: 'build'
  },
  {
    id: 'LI-1003',
    type: 'Material',
    task: 'Cable Tray 100mm',
    quantity: 20,
    unit: 'pcs',
    price: 12.5,
    date: new Date(2024, 0, 7),
    active: true,
    phase: 'test'
  },
  {
    id: 'LI-1004',
    type: 'Material',
    task: 'Cable Ties (100 pack)',
    quantity: 5,
    unit: 'pkg',
    price: 7.5,
    date: new Date(2024, 0, 8),
    active: true,
    phase: 'design'
  },
  {
    id: 'LI-1005',
    type: 'Labor',
    task: 'Mounting Labor',
    quantity: 18,
    unit: 'hr',
    price: 45,
    date: new Date(2024, 0, 9),
    active: true,
    phase: 'build'
  },
  {
    id: 'LI-1006',
    type: 'Equipment',
    task: 'Boom Lift Rental',
    quantity: 2,
    unit: 'day',
    price: 320,
    date: new Date(2024, 0, 10),
    active: false,
    phase: 'build'
  },
  {
    id: 'LI-1007',
    type: 'Labor',
    task: 'Electrical Testing',
    quantity: 6,
    unit: 'hr',
    price: 60,
    date: new Date(2024, 0, 11),
    active: true,
    phase: 'test'
  },
  {
    id: 'LI-1008',
    type: 'Material',
    task: 'Junction Box',
    quantity: 12,
    unit: 'pcs',
    price: 15.75,
    date: new Date(2024, 0, 12),
    active: false,
    phase: 'design'
  }
];

const baseColumns: GridSchema<SampleRow> = [
  { key: 'id', header: 'ID', type: 'string', readOnly: true },
  { key: 'type', header: 'Type', type: 'string', readOnly: true },
  { key: 'task', header: 'Task', type: 'string' },
  { key: 'quantity', header: 'Quantity', type: 'number', align: 'right', step: 1, min: 0 },
  { key: 'unit', header: 'Unit', type: 'string' },
  { key: 'price', header: 'Price', type: 'currency', align: 'right', currency: 'USD' },
  { key: 'date', header: 'Date', type: 'date' },
  { key: 'active', header: 'Active', type: 'boolean' },
  {
    key: 'phase',
    header: 'Phase',
    type: 'select',
    options: [
      { label: 'Design', value: 'design' },
      { label: 'Build', value: 'build' },
      { label: 'Test', value: 'test' }
    ]
  }
];

const meta: Meta<typeof TComp> = {
  title: 'Components/TComp',
  component: TComp,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    onChange: { action: 'changed' },
    onCellEdit: { action: 'cell edited' }
  }
};

export default meta;

type Story = StoryObj<typeof TComp>;

// Shared interactive render for basic stories
const Interactive: Story['render'] = args => {
  const [rows, setRows] = useState<SampleRow[]>(baseRows);

  return (
    <TComp
      data={rows}
      columns={baseColumns}
      {...args}
      onChange={next => {
        setRows(next as SampleRow[]);
        // Forward to actions for logging
        (args as any).onChange?.(next);
      }}
      onCellEdit={evt => {
        (args as any).onCellEdit?.(evt);
      }}
    />
  );
};

export const Default: Story = {
  render: Interactive,
  args: {
    density: 'normal',
    borders: 'row',
    headerTone: 'default',
    striped: true,
    hoverable: true,
    selectable: true
  }
};

export const Compact: Story = {
  render: Interactive,
  args: {
    density: 'compact',
    striped: true
  }
};

export const Spacious: Story = {
  render: Interactive,
  args: {
    density: 'spacious'
  }
};

export const WithStickyHeader: Story = {
  render: args => {
    // Generate many rows to demonstrate internal scroll + sticky header
    const makeRows = (count: number): SampleRow[] => {
      const rows: SampleRow[] = [];
      for (let i = 0; i < count; i++) {
        rows.push({
          id: `LI-20${(i + 1).toString().padStart(2, '0')}`,
          type: i % 3 === 0 ? 'Material' : i % 3 === 1 ? 'Labor' : 'Equipment',
          task: `Task ${i + 1}`,
          quantity: (i + 1) * 2,
          unit: i % 2 === 0 ? 'pcs' : 'm',
          price: (i % 5) * 10 + 5.5,
          date: new Date(2024, 0, 1 + i),
          active: i % 2 === 0,
          phase: (['design', 'build', 'test'] as const)[i % 3]
        });
      }
      return rows;
    };

    const [rows, setRows] = useState<SampleRow[]>(makeRows(30));

    return (
      <TComp
        data={rows}
        columns={baseColumns}
        {...args}
        containerHeight="24rem"
        onChange={next => {
          setRows(next as SampleRow[]);
          (args as any).onChange?.(next);
        }}
        onCellEdit={evt => {
          (args as any).onCellEdit?.(evt);
        }}
      />
    );
  },
  args: {
    striped: true
  }
};

export const EuroCurrency: Story = {
  render: args => {
    const [rows, setRows] = useState<SampleRow[]>(baseRows);

    // Remove explicit USD on the Price column so defaultCurrency can apply (EUR)
    const euroColumns: GridSchema<SampleRow> = baseColumns.map(col =>
      col.key === 'price' ? { ...col, currency: undefined } : col
    ) as GridSchema<SampleRow>;

    return (
      <TComp
        data={rows}
        columns={euroColumns}
        {...args}
        defaultLocale="de-DE"
        defaultCurrency="EUR"
        onChange={next => {
          setRows(next as SampleRow[]);
          (args as any).onChange?.(next);
        }}
        onCellEdit={evt => {
          (args as any).onCellEdit?.(evt);
        }}
      />
    );
  }
};

export const WithValidation: Story = {
  render: args => {
    const [rows, setRows] = useState<SampleRow[]>(baseRows);

    const columnsWithValidation: GridSchema<SampleRow> = baseColumns.map(col =>
      col.key === 'quantity'
        ? {
            ...col,
            min: 1,
            max: 100,
            validator: (value: unknown) => {
              const n =
                typeof value === 'number'
                  ? value
                  : value == null
                    ? NaN
                    : Number.isNaN(Number(value))
                      ? NaN
                      : Number(value);
              if (!Number.isFinite(n)) return 'Quantity must be a number';
              if (n < 1 || n > 100) return 'Quantity must be between 1 and 100';
              return null;
            }
          }
        : col
    ) as GridSchema<SampleRow>;

    return (
      <TComp
        data={rows}
        columns={columnsWithValidation}
        {...args}
        onChange={next => {
          setRows(next as SampleRow[]);
          (args as any).onChange?.(next);
        }}
        onCellEdit={evt => {
          (args as any).onCellEdit?.(evt);
        }}
      />
    );
  },
  args: {
    striped: true
  }
};

export const WithRowClick: Story = {
  render: args => {
    const [rows, setRows] = useState<SampleRow[]>(baseRows);
    return (
      <TComp
        data={rows}
        columns={baseColumns}
        {...args}
        onChange={next => {
          setRows(next as SampleRow[]);
          (args as any).onChange?.(next);
        }}
        onCellEdit={evt => {
          (args as any).onCellEdit?.(evt);
        }}
      />
    );
  },
  args: {
    striped: true,
    hoverable: true
  }
};