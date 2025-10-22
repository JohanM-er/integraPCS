import { Badge } from './Badge';

import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  parameters: {
    layout: 'centered'
  },
  args: {
    children: 'Badge'
  }
};

export default meta;

type Story = StoryObj<typeof Badge>;

// Variant Examples
export const Neutral: Story = {
  args: {
    variant: 'neutral',
    children: 'Neutral'
  }
};

export const Brand: Story = {
  args: {
    variant: 'brand',
    children: 'Brand'
  }
};

export const Inverse: Story = {
  args: {
    variant: 'inverse',
    children: 'Inverse'
  }
};

// Size Examples
export const Small: Story = {
  args: {
    variant: 'brand',
    size: 'sm',
    children: 'Small'
  }
};

export const Medium: Story = {
  args: {
    variant: 'brand',
    size: 'md',
    children: 'Medium (default)'
  }
};

export const Large: Story = {
  args: {
    variant: 'brand',
    size: 'lg',
    children: 'Large'
  }
};

// All Sizes Together
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Badge variant="brand" size="sm">
        Small
      </Badge>
      <Badge variant="brand" size="md">
        Medium
      </Badge>
      <Badge variant="brand" size="lg">
        Large
      </Badge>
    </div>
  )
};

// All Variants Together
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="brand">Brand</Badge>
      <Badge variant="inverse">Inverse</Badge>
    </div>
  )
};

// Status Use Case (Grid Context)
export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm">Default:</span>
        <Badge variant="brand" size="md">
          On Track
        </Badge>
        <Badge variant="neutral" size="md">
          At Risk
        </Badge>
        <Badge variant="neutral" size="md">
          Blocked
        </Badge>
        <Badge variant="neutral" size="md">
          Complete
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm">Small (Grid):</span>
        <Badge variant="brand" size="sm">
          On Track
        </Badge>
        <Badge variant="neutral" size="sm">
          At Risk
        </Badge>
        <Badge variant="neutral" size="sm">
          Blocked
        </Badge>
        <Badge variant="neutral" size="sm">
          Complete
        </Badge>
      </div>
    </div>
  )
};

// Min-width demonstration
export const MinWidthConsistency: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm text-neutral-900">
          Small badges have min-width for consistency:
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="brand" size="sm">
            A
          </Badge>
          <Badge variant="brand" size="sm">
            OK
          </Badge>
          <Badge variant="brand" size="sm">
            Done
          </Badge>
          <Badge variant="brand" size="sm">
            Active
          </Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-neutral-900">Medium badges:</p>
        <div className="flex items-center gap-2">
          <Badge variant="brand" size="md">
            A
          </Badge>
          <Badge variant="brand" size="md">
            OK
          </Badge>
          <Badge variant="brand" size="md">
            Done
          </Badge>
          <Badge variant="brand" size="md">
            Active
          </Badge>
        </div>
      </div>
    </div>
  )
};
