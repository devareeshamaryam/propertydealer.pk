//  import { Property } from "./columns"

export type Property = {
  title: string
  status: "Active" | "Pending" | "Sold"
  type: "Rent" | "Sell"
  price: string
  location: string  
}

export const data: Property[] = [
  {
    title: "House DHA Phase 6",
    type: "Sell",
    status: "Active",
    price: "PKR 2.5 Crore",
    location: "DHA Phase 6, Karachi",  
  },
  {
    title: "Apartment Gulshan",
    type: "Rent",
    status: "Pending",
    price: "PKR 90,000 / month",
    location: "Gulshan-e-Iqbal, Karachi",  
  },
  {
    title: "Villa Bahria Town",
    type: "Sell",
    status: "Sold",
    price: "PKR 4 Crore",
    location: "Bahria Town, Karachi",  
  },
]