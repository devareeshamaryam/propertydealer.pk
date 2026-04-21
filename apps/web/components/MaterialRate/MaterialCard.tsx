export interface MaterialBrand {
  id: string | number;
  brand: string;
  slug: string;
  title: string;
  price: number;
  change: number;
  unit: string;
  category: string;
  image?: string;
  materialType: string;
}

interface MaterialCardProps {
  item: MaterialBrand;
}

export default function MaterialCard({ item }: MaterialCardProps) {
  const changeColor = item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-600" : "text-gray-600";
  const changeIcon = item.change > 0 ? "↑" : item.change < 0 ? "↓" : "→";

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {item.image && (
        <img src={item.image} alt={item.brand} className="w-full h-40 object-cover rounded-md mb-3" />
      )}
      <h3 className="font-bold text-lg mb-2">{item.brand}</h3>
      <p className="text-sm text-gray-600 mb-2">{item.category}</p>
      <div className="flex justify-between items-center">
        <span className="text-2xl font-bold text-blue-600">Rs. {item.price.toLocaleString()}</span>
        <span className={`text-sm font-semibold ${changeColor}`}>
          {changeIcon} {Math.abs(item.change)}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{item.unit}</p>
    </div>
  );
}
