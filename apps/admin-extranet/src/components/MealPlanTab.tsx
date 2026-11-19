import MealPlanRateGrid from '@/components/MealPlanRateGrid';

interface Props {
  hotelId: string;
  supplements?: any[];
  seasons?: any[];
  onSave?: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  saving?: boolean;
}

export default function MealPlanTab({ hotelId }: Props) {
  return <MealPlanRateGrid hotelId={hotelId} />;
}
