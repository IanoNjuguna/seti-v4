export interface Transaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'pill';
export type BadgeVariant = 'success' | 'neutral' | 'warning' | 'danger';
