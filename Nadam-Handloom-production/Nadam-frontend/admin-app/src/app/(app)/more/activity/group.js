// The entries inside a grouped Activity line (Module 10, 6.5): "added 48 sarees" → the 48.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { Card } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { EntryRow, EntrySheet } from '../../../../components/activity/Parts';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../hooks/useBack';
import { getGroup } from '../../../../activity/group';

export default function ActivityGroup() {
  const goBack = useBack();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const g = getGroup();
  const [open, setOpen] = useState(null);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <TopBar title={g ? `${g.count} entries` : 'Activity'} onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll, gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        {g ? (
          <>
            <T variant="small" color="text2">{g.text} · {g.date}, {g.time}</T>
            <Card>{g.items.map((e, i) => <EntryRow key={e.id} e={e} onPress={() => setOpen(e)} last={i === g.items.length - 1} />)}</Card>
            {g.more ? <T variant="caption" color="muted">And {g.more} more; they continue further down the list.</T> : null}
          </>
        ) : <T color="muted">Open a grouped line in Activity.</T>}
      </ScrollView>
      <EntrySheet e={open} onClose={() => setOpen(null)} />
    </View>
  );
}
