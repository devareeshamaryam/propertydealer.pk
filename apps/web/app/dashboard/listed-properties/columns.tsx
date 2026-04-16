 

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type Property = {
  title: string
  status: "Active" | "Pending" | "Sold"
  type: "Rent" | "Sell"
  price: string
}

export const columns: ColumnDef<Property>[] = [
  {
    accessorKey: "title",
    header: "Property",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("type") as string
      return (
        <Badge variant={type === "Rent" ? "secondary" : "default"}>
          {type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant="outline">{status}</Badge>
      )
    },
  },
  {
    accessorKey: "price",
    header: "Price",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const property = row.original

      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              alert(`Edit: ${property.title}`)
            }}
          >
            Edit
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete?")) {
                alert(`Deleted: ${property.title}`)
              }
            }}
          >
            Delete
          </Button>
        </div>
      )
    },
  },
]
