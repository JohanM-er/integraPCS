import { WorkPackageGrid, type WorkPackageRow, type GridFilter, type GridMetadata } from './WorkPackageGrid';
import type { Meta, StoryObj } from '@storybook/react';

const sampleRows: WorkPackageRow[] = [
  {
    id: 'WP-1182',
    name: 'Turbine Alignment Review',
    owner: 'D. Richards',
    phase: 'Design',
    start: '2025-02-01',
    end: '2025-02-07',
    status: 'On Track',
    score: 92
  },
  {
    id: 'WP-1183',
    name: 'Structural Load Analysis',
    owner: 'A. Chen',
    phase: 'Design',
    start: '2025-02-04',
    end: '2025-02-15',
    status: 'At Risk',
    score: 68
  },
  {
    id: 'WP-1184',
    name: 'Foundation Excavation',
    owner: 'M. Patel',
    phase: 'Build',
    start: '2025-02-06',
    end: '2025-02-20',
    status: 'Blocked',
    score: 45
  },
  {
    id: 'WP-1185',
    name: 'Electrical Wiring Plan',
    owner: 'S. Alvarez',
    phase: 'Design',
    start: '2025-02-10',
    end: '2025-02-18',
    status: 'On Track',
    score: 88
  },
  {
    id: 'WP-1186',
    name: 'Cooling System Integration',
    owner: 'K. Nguyen',
    phase: 'Build',
    start: '2025-02-12',
    end: '2025-02-25',
    status: 'On Track',
    score: 90
  },
  {
    id: 'WP-1187',
    name: 'QA Test Suite Prep',
    owner: "P. O'Neal",
    phase: 'Test',
    start: '2025-02-14',
    end: '2025-02-22',
    status: 'At Risk',
    score: 73
  },
  {
    id: 'WP-1188',
    name: 'Scaffolding Safety Audit',
    owner: 'L. Romero',
    phase: 'Build',
    start: '2025-02-16',
    end: '2025-02-19',
    status: 'On Track',
    score: 85
  },
  {
    id: 'WP-1189',
    name: 'Commissioning Checklist',
    owner: 'J. Singh',
    phase: 'Deploy',
    start: '2025-02-20',
    end: '2025-02-28',
    status: 'Complete',
    score: 96
  }
];

const sampleFilters: GridFilter[] = [
  { id: 'status', label: 'Status', value: 'Active', selected: true },
  { id: 'region', label: 'Region', value: 'AMER', selected: true },
  { id: 'owner', label: 'Owner', value: 'Unassigned', selected: false }
];

const sampleMetadata: GridMetadata = {
  rowsCount: 8,
  columnsSelected: 12,
  lastSyncText: '4 minutes ago'
};

const meta: Meta<typeof WorkPackageGrid> = {
  title: 'Components/WorkPackageGrid',
  component: WorkPackageGrid,
  parameters: {
    layout: 'centered'
  },
  args: {
    title: 'Operational Snapshot',
    rows: sampleRows,
    filters: sampleFilters,
    metadata: sampleMetadata
  },
  argTypes: {
    onRowClick: { action: 'row clicked' }
  }
};

export default meta;

type Story = StoryObj<typeof WorkPackageGrid>;

export const Default: Story = {
  args: {
    density: 'normal',
    borders: 'row',
    headerTone: 'default',
    stickyHeader: false,
    showFooter: true
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
    stickyHeader: true
  },
  render: (args) => (
    <div style={{ width: '48rem', height: '24rem', overflow: 'auto' }}>
      <WorkPackageGrid {...args} />
    </div>
  )
};

export const WithRowClick: Story = {
  args: {
    // onRowClick is wired to Storybook actions via argTypes
  }
};