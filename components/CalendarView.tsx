import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import "react-day-picker/dist/style.css";

export function CalendarView() {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
        // Format date as YYYY-MM-DD for the URL
        const dateStr = day.toISOString().split('T')[0];
        navigate(`/calendar/${dateStr}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Calendrier</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sélectionnez une date</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        onDayClick={handleDayClick}
                        locale={fr}
                        className="border rounded-md p-4"
                        modifiersClassNames={{
                            selected: "bg-primary text-primary-foreground hover:bg-primary/90",
                            today: "font-bold text-primary"
                        }}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
