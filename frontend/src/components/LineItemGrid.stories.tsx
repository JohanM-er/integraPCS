import { LineItemGrid, type LineItemRow } from './LineItemGrid';

import type { Meta, StoryObj } from '@storybook/react';

const sampleRows: LineItemRow[] = [
  {
    id: 'LI-1001',
    type: 'Material',
    task: 'DC Cable 4mm',
    quantity: 120,
    unit: 'm',
    price: 1.25
  },
  {
    id: 'LI-1002',
    type: 'Material',
    task: 'AC Cable 6mm',
    quantity: 75,
    unit: 'm',
    price: 1.95
  },
  {
    id: 'LI-1003',
    type: 'Material',
    task: 'Cable Tray 100mm',
    quantity: 20,
    unit: 'pcs',
    price: 12.5,
    total: 250
  },
  {
    id: 'LI-1004',
    type: 'Material',
    task: 'Cable Ties (100 pack)',
    quantity: 5,
    unit: 'pkg',
    price: 7.5
  },
  {
    id: 'LI-1005',
    type: 'Labor',
    task: 'Mounting Labor',
    quantity: 18,
    unit: 'hr',
    price: 45
  },
  {
    id: 'LI-1006',
    type: 'Equipment',
    task: 'Boom Lift Rental',
    quantity: 2,
    unit: 'day',
    price: 320
  }
];

const meta: Meta<typeof LineItemGrid> = {
  title: 'Components/LineItemGrid',
  component: LineItemGrid,
  parameters: {
    layout: 'centered'
  },
  args: {
    rows: sampleRows
  },
  argTypes: {
    onRowClick: { action: 'row clicked' }
  }
};

export default meta;

type Story = StoryObj<typeof LineItemGrid>;

export const Default: Story = {
  args: {
    density: 'normal',
    borders: 'row',
    headerTone: 'default',
    stickyHeader: false
  }
};

export const Compact: Story = {
  args: {
    density: 'compact'
  }
};

export const Spacious: Story = {
  args: {
    density: 'spacious'
  }
};

export const WithStickyHeader: Story = {
  args: {
    // Auto-sticky enabled by providing a container height
    containerHeight: '24rem'
  }
};

export const WithRowClick: Story = {
  args: {
    // onRowClick is wired to Storybook actions via argTypes
  }
};

export const EuroCurrency: Story = {
  args: {
    locale: 'de-DE',
    currency: 'EUR'
  }
};
