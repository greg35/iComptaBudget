import React from 'react';
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { cn } from "../ui/utils";

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'table' | 'chart';
    chartType?: 'bar' | 'line' | 'pie';
    data?: any[];
    timestamp: Date;
}

interface MessageBubbleProps {
    message: Message;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    const renderContent = () => {
        if (message.type === 'table' && message.data && message.data.length > 0) {
            const columns = Object.keys(message.data[0]);
            return (
                <div className="mt-2 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col}>{col}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {message.data.map((row, i) => (
                                <TableRow key={i}>
                                    {columns.map((col) => (
                                        <TableCell key={col}>{row[col]}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            );
        }

        if (message.type === 'chart' && message.data && message.data.length > 0) {
            // Determine keys for chart
            const keys = Object.keys(message.data[0]);
            // Assuming first key is name/category and second is value
            // Or look for specific keys like 'name', 'date', 'amount', 'value'
            let nameKey = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('date') || k.toLowerCase().includes('category')) || keys[0];
            let valueKey = keys.find(k => k !== nameKey && (typeof message.data![0][k] === 'number')) || keys[1];

            return (
                <div className="h-[300px] w-full mt-4 min-w-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {message.chartType === 'line' ? (
                            <LineChart data={message.data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={nameKey} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey={valueKey} stroke="#8884d8" />
                            </LineChart>
                        ) : message.chartType === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={message.data}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey={valueKey}
                                    nameKey={nameKey}
                                >
                                    {message.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : (
                            <BarChart data={message.data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={nameKey} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey={valueKey} fill="#8884d8" />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div >
            );
        }

        return null;
    };

    return (
        <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg p-4", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {renderContent()}
                <div className="text-xs opacity-50 mt-1 text-right">
                    {message.timestamp.toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}
