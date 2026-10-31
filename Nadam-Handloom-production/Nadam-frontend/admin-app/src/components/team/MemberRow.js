// One person in the team list.
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Badge, Row } from '../Bits';
import { Icon } from '../Icon';
import { T } from '../T';
import { memberSubline, STATUS_BADGE } from '../../utils/team';

export function MemberRow({ member: m, onPress, last }) {
  const { c, radius } = useTheme();
  return (
    <Row
      onPress={onPress}
      last={last}
      accessibilityLabel={`${m.name}${m.isYou ? ', you' : ''}, ${memberSubline(m)}`}
      title={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T variant="bodyStrong">{m.name}</T>
          {m.isMainOwner ? <Icon name="crown" size={16} color={c.accent} /> : null}
          {m.isYou ? <View style={{ borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill, paddingHorizontal: 6 }}><T variant="caption" color="muted">You</T></View> : null}
        </View>
      )}
      subtitle={memberSubline(m)}
      leading={<Avatar name={m.name} size={40} muted={m.status === 'removed'} />}
      right={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {m.status === 'invited' ? <Badge {...STATUS_BADGE.invited} /> : null}
          <Icon name="right" size={18} color={c.muted} />
        </View>
      )}
    />
  );
}
