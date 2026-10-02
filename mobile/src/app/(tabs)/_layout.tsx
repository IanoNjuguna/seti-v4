import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';

function TabLabel({ focused, title }: { focused: boolean; title: string }) {
  return (
    <Text
      variant="tab"
      className={focused ? 'text-accent-primary' : 'text-text-secondary'}
    >
      {title}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={focused ? '#059669' : '#64748B'}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Home" />,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: 'Pay',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'scan' : 'scan-outline'}
              size={24}
              color={focused ? '#059669' : '#64748B'}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Pay" />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={24}
              color={focused ? '#059669' : '#64748B'}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Activity" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? '#059669' : '#64748B'}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Profile" />,
        }}
      />
    </Tabs>
  );
}
