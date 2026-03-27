package open.dolphin.converter;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

public final class ModelCopySupport {

    private ModelCopySupport() {
    }

    public static <T> T copy(T source, Supplier<T> factory) {
        if (source == null) {
            return null;
        }
        T target = factory.get();
        copyFields(source, target, source.getClass());
        return target;
    }

    private static void copyFields(Object source, Object target, Class<?> type) {
        if (type == null || type == Object.class) {
            return;
        }
        copyFields(source, target, type.getSuperclass());
        for (Field field : type.getDeclaredFields()) {
            int modifiers = field.getModifiers();
            if (Modifier.isStatic(modifiers) || Modifier.isFinal(modifiers) || field.isSynthetic()) {
                continue;
            }
            try {
                field.setAccessible(true);
                field.set(target, copyValue(field.get(source)));
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException("Failed to copy " + type.getName() + "." + field.getName(), ex);
            }
        }
    }

    private static Object copyValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Date date) {
            return new Date(date.getTime());
        }
        if (value instanceof Collection<?> collection) {
            return new ArrayList<>(collection);
        }
        if (value instanceof Map<?, ?> map) {
            return new LinkedHashMap<>(map);
        }
        Class<?> type = value.getClass();
        if (type.isArray()) {
            int length = Array.getLength(value);
            Object copy = Array.newInstance(type.getComponentType(), length);
            System.arraycopy(value, 0, copy, 0, length);
            return copy;
        }
        return value;
    }
}
