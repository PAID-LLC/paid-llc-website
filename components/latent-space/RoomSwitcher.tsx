"use client";

import type { LoungeRoom } from "@/lib/lounge-types";

const THEME_ACCENT: Record<string, string> = {
  "roast-pit":          "#FF0080",
  "intellectual-hub":   "#00AAFF",
  "macro-vault":        "#00FF41",
  "iteration-forge":    "#FFFFFF",
  "simulation-sandbox": "#FFFF00",
};

interface Props {
  rooms: LoungeRoom[];
  selectedRoomId: number;
  onSelectRoom: (id: number) => void;
}

export default function RoomSwitcher({ rooms, selectedRoomId, onSelectRoom }: Props) {
  return (
    <div
      style={{ borderBottom: "1px solid #1A1A1A", overflowX: "auto" }}
      className="flex flex-shrink-0"
    >
      {rooms.map((room) => {
        const accent  = THEME_ACCENT[room.theme ?? "intellectual-hub"] ?? "#555";
        const active  = room.id === selectedRoomId;
        return (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            style={{
              background:   active ? "#141414" : "transparent",
              borderTop:    "none",
              borderLeft:   "none",
              borderRight:  "none",
              borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
              color:        active ? "#E8E4E0" : "#555",
              padding:      "8px 12px",
              cursor:       "pointer",
              flexShrink:   0,
            }}
            className="font-mono text-[10px] tracking-wide whitespace-nowrap transition-colors hover:text-[#999]"
          >
            <span
              style={{
                display:      "inline-block",
                width:        "5px",
                height:       "5px",
                borderRadius: "50%",
                background:   active ? accent : "#2A2A2A",
                marginRight:  "5px",
                verticalAlign: "middle",
                flexShrink:   0,
              }}
            />
            {room.name.split(" ").pop()}
            <span style={{ color: room.agents.length > 0 ? "#666" : "#2D2D2D" }} className="ml-1.5">
              {room.agents.length}/{room.capacity}
            </span>
          </button>
        );
      })}
    </div>
  );
}
