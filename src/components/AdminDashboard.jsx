// AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase-config';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const AdminDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState({
    subjectStats: [],
    userStats: [],
    branchStats: []
  });
  const [selectedView, setSelectedView] = useState('subjects');
  const [dateRange, setDateRange] = useState('week');
  const [isLoading, setIsLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const analyticsRef = collection(db, 'analytics');
        const querySnapshot = await getDocs(analyticsRef);
        
        const data = {
          subjectStats: [],
          userStats: [],
          branchStats: []
        };

        // Process analytics data
        querySnapshot.forEach((doc) => {
          const analyticsData = doc.data();
          // Group by subject
          if (analyticsData.subject) {
            const subjectIndex = data.subjectStats.findIndex(s => s.subject === analyticsData.subject);
            if (subjectIndex === -1) {
              data.subjectStats.push({
                subject: analyticsData.subject,
                timeSpent: analyticsData.duration,
                views: 1
              });
            } else {
              data.subjectStats[subjectIndex].timeSpent += analyticsData.duration;
              data.subjectStats[subjectIndex].views += 1;
            }
          }

          // Group by branch/class
          if (analyticsData.branch) {
            const branchIndex = data.branchStats.findIndex(b => b.name === analyticsData.branch);
            if (branchIndex === -1) {
              data.branchStats.push({
                name: analyticsData.branch,
                students: 1,
                avgTimeSpent: analyticsData.duration
              });
            } else {
              data.branchStats[branchIndex].students += 1;
              data.branchStats[branchIndex].avgTimeSpent = 
                (data.branchStats[branchIndex].avgTimeSpent + analyticsData.duration) / 2;
            }
          }
        });

        setAnalyticsData(data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
      setIsLoading(false);
    };

    fetchAnalytics();
  }, [dateRange]);

  const renderSubjectChart = () => (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={analyticsData.subjectStats}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="subject" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="timeSpent" name="Time Spent (minutes)" fill="#8884d8" />
          <Bar dataKey="views" name="Views" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderBranchChart = () => (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={analyticsData.branchStats}
            dataKey="students"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={150}
            label
          >
            {analyticsData.branchStats.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div className="space-x-4">
              <button
                className={`px-4 py-2 rounded ${
                  selectedView === 'subjects' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
                onClick={() => setSelectedView('subjects')}
              >
                Subject Analytics
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  selectedView === 'branches' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
                onClick={() => setSelectedView('branches')}
              >
                Branch Analytics
              </button>
            </div>
            
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border rounded"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
            </div>
          ) : (
            <>
              {selectedView === 'subjects' && renderSubjectChart()}
              {selectedView === 'branches' && renderBranchChart()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;